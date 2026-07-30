import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';
import { Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { mutation, StatefulService } from 'services/core/stateful-service';
import { CustomizationService } from 'services/customization';
import { ObsIpcHealthService } from 'services/obs-ipc-health';
import { VideoSettingsService } from 'services/settings-v2/video';
import { EStreamingState, StreamingService } from 'services/streaming';
import { getKeys } from 'util/getKeys';
import { isObsBackendIpcLost } from 'util/obs-ipc-error';
import { getLastObsOp } from 'util/sentry-obs-breadcrumb';
import { SentryReport } from 'util/sentry-report';

import * as obs from '../../../obs-api';

export type StreamQuality = 'GOOD' | 'FAIR' | 'POOR';

interface IPerformanceState {
  CPU: number;
  numberDroppedFrames: number;
  percentageDroppedFrames: number;
  streamingBandwidth: number;
  frameRate: number;
  // フレーム統計の累積値（差分計算用）
  numberLaggedFrames: number;
  numberRenderedFrames: number;
  numberSkippedFrames: number;
  numberEncodedFrames: number;
  // 配信品質インジケーター
  streamQuality: StreamQuality;
  // UI表示用の各指標の割合
  percentageLaggedFrames: number;
  percentageSkippedFrames: number;
}

const STATS_UPDATE_INTERVAL = 2 * 1000;

// Keeps a store of up-to-date performance metrics
export class PerformanceService extends StatefulService<IPerformanceState> {
  @Inject()
    customizationService: CustomizationService;
  @Inject()
  private videoSettingsService: VideoSettingsService;
  @Inject()
  private streamingService: StreamingService;
  @Inject()
  private obsIpcHealthService: ObsIpcHealthService;

  static initialState: IPerformanceState = {
    CPU: 0,
    numberDroppedFrames: 0,
    percentageDroppedFrames: 0,
    streamingBandwidth: 0,
    frameRate: 0,
    numberLaggedFrames: 0,
    numberRenderedFrames: 0,
    numberSkippedFrames: 0,
    numberEncodedFrames: 0,
    streamQuality: 'GOOD',
    percentageLaggedFrames: 0,
    percentageSkippedFrames: 0,
  };

  private intervalId: number;
  private statsFailed: boolean = false;
  private frameStatsFailed: boolean = false;
  private ipcLostSubscription: Subscription;

  private zeroBandwidthSamples = 0;
  private zeroBandwidthAlertSent = false;
  private zeroBandwidthStartedAt: number | null = null;
  private readonly ZERO_BANDWIDTH_THRESHOLD = 15; // 15 × 2s = 30s

  // 移動平均用の履歴配列
  private historicalDroppedFrames: number[] = [];
  private historicalSkippedFrames: number[] = [];
  private historicalLaggedFrames: number[] = [];
  private readonly NUMBER_OF_SAMPLES = 60; // 60 × 2秒 = 2分

  @mutation()
  SET_PERFORMANCE_STATS(stats: Partial<IPerformanceState>) {
    getKeys(stats).forEach((stat) => {
      (this.state as any)[stat] = stats[stat];
    });
  }

  init() {
    this.intervalId = window.setInterval(() => this.update(), STATS_UPDATE_INTERVAL);

    // IPC 切断後はポーリングしても必ず失敗し、2秒ごとに Sentry ノイズを生むだけなので停止する。
    this.ipcLostSubscription = this.obsIpcHealthService.ipcLost.subscribe(() => this.stop());

    // init() より前に切断が検知されていた場合にもポーリングを止める
    if (this.obsIpcHealthService.isLost) this.stop();
    // 配信状態の変化を監視して履歴をリセット
    this.streamingService.streamingStatusChange.subscribe((status) => {
      if (status === EStreamingState.Live) {
        this.historicalDroppedFrames = [];
        this.historicalLaggedFrames = [];
        this.historicalSkippedFrames = [];
        this.zeroBandwidthSamples = 0;
        this.zeroBandwidthAlertSent = false;
        this.zeroBandwidthStartedAt = null;
      } else if (status === EStreamingState.Offline) {
        this.zeroBandwidthSamples = 0;
        this.zeroBandwidthAlertSent = false;
        this.zeroBandwidthStartedAt = null;
      }
    });
  }

  private getState(): IPerformanceState | null {
    if (!this.customizationService.pollingPerformanceStatistics) {
      return {
        CPU: 0,
        numberDroppedFrames: 0,
        percentageDroppedFrames: 0,
        streamingBandwidth: 0,
        frameRate: 0,
        numberLaggedFrames: 0,
        numberRenderedFrames: 0,
        numberSkippedFrames: 0,
        numberEncodedFrames: 0,
        streamQuality: 'GOOD',
        percentageLaggedFrames: 0,
        percentageSkippedFrames: 0,
      };
    }
    try {
      const stats = obs.NodeObs.OBS_API_getPerformanceStatistics();
      // OBS API が返さないプロパティをデフォルト値で補完
      return {
        ...stats,
        numberLaggedFrames: this.state.numberLaggedFrames || 0,
        numberRenderedFrames: this.state.numberRenderedFrames || 0,
        numberSkippedFrames: this.state.numberSkippedFrames || 0,
        numberEncodedFrames: this.state.numberEncodedFrames || 0,
        streamQuality: this.state.streamQuality || 'GOOD',
        percentageLaggedFrames: this.state.percentageLaggedFrames || 0,
        percentageSkippedFrames: this.state.percentageSkippedFrames || 0,
      };
    } catch (e) {
      if (isObsBackendIpcLost(e)) {
        // 復旧不能な切断。ObsIpcHealthService 側で1度だけ Sentry 報告＋ダイアログを出すので、
        // ここでは個別の SentryReport / breadcrumb を積まない
        this.obsIpcHealthService.notifyIpcLost('PerformanceService.getState');
        return null;
      }
      if (this.statsFailed) {
        // Sentryイベント数削減のため、2回目以降はbreadcrumbsに記録する
        Sentry.addBreadcrumb({
          category: 'performance.getState',
          message: String(e),
          level: 'warning',
          data: {
            errorName: e instanceof Error ? e.name : typeof e,
            errorMessage: e instanceof Error ? e.message : String(e),
          },
        });
      } else {
        SentryReport.error('PerformanceService', 'getState', e, {
          extra: {
            streamingStatus: this.streamingService.state.streamingStatus,
            lastObsOp: getLastObsOp(),
          },
        });
      }
      return null;
    }
  }

  private update() {
    const stats = this.getState();
    if (!stats) {
      if (this.statsFailed) {
        // sentry送信削減
        return;
      }
      this.statsFailed = true;
      return; // stats が null の場合は処理を中断
    }

    // 正常に取得できた場合はフラグをリセット
    this.statsFailed = false;

    // CPU 計算（既存）
    const am = remote.app.getAppMetrics();
    stats.CPU += am
      .map((proc) => {
        return proc.cpu.percentCPUUsage;
      })
      .reduce((sum, usage) => sum + usage);

    // OBS からフレーム統計を取得。取得できない場合は前回値を流用し、
    // 差分0として残りの統計（CPU / 帯域）の更新を継続する
    const frames = this.readFrameStats() ?? {
      lagged: this.state.numberLaggedFrames,
      rendered: this.state.numberRenderedFrames,
      skipped: this.state.numberSkippedFrames,
      encoded: this.state.numberEncodedFrames,
    };
    const currentLaggedFrames = frames.lagged;
    const currentRenderedFrames = frames.rendered;
    const currentSkippedFrames = frames.skipped;
    const currentEncodedFrames = frames.encoded;

    // 差分ファクターの計算（前回からの変化量）
    const framesLagged = currentLaggedFrames - this.state.numberLaggedFrames;
    const framesRendered = currentRenderedFrames - this.state.numberRenderedFrames;
    const laggedFactor = framesRendered === 0 ? 0 : framesLagged / framesRendered;

    const framesSkipped = currentSkippedFrames - this.state.numberSkippedFrames;
    const framesEncoded = currentEncodedFrames - this.state.numberEncodedFrames;
    const skippedFactor = framesEncoded === 0 ? 0 : framesSkipped / framesEncoded;

    const droppedFactor = stats.percentageDroppedFrames ? stats.percentageDroppedFrames / 100 : 0;

    // 移動平均へのサンプル追加
    this.addSample(this.historicalDroppedFrames, droppedFactor);
    this.addSample(this.historicalLaggedFrames, laggedFactor);
    this.addSample(this.historicalSkippedFrames, skippedFactor);

    // 配信品質の計算
    const streamQuality = this.calculateStreamQuality();

    // 状態更新
    this.SET_PERFORMANCE_STATS({
      ...stats,
      numberLaggedFrames: currentLaggedFrames,
      numberRenderedFrames: currentRenderedFrames,
      numberSkippedFrames: currentSkippedFrames,
      numberEncodedFrames: currentEncodedFrames,
      percentageLaggedFrames: laggedFactor * 100,
      percentageSkippedFrames: skippedFactor * 100,
      streamQuality,
    });

    if (this.streamingService.state.streamingStatus === EStreamingState.Live) {
      if (stats.streamingBandwidth === 0) {
        if (this.zeroBandwidthSamples === 0) {
          this.zeroBandwidthStartedAt = Date.now();
          Sentry.addBreadcrumb({
            category: 'streaming',
            message: 'bandwidth dropped to 0',
            level: 'warning',
            data: {
              CPU: stats.CPU,
              droppedFrames: stats.numberDroppedFrames,
              percentageDroppedFrames: stats.percentageDroppedFrames,
            },
          });
        }
        this.zeroBandwidthSamples++;
        if (
          this.zeroBandwidthSamples === this.ZERO_BANDWIDTH_THRESHOLD &&
          !this.zeroBandwidthAlertSent
        ) {
          const streamElapsedSec = this.streamingService.state.streamingStatusTime
            ? Math.round(
              (Date.now() -
                  new Date(this.streamingService.state.streamingStatusTime).getTime()) /
                  1000,
            )
            : -1;
          SentryReport.message('PerformanceService', 'update', 'streaming bandwidth stuck at 0kbps', {
            level: 'warning',
            tags: { condition: 'bandwidthZero' },
            fingerprint: ['PerformanceService', 'bandwidthZero'],
            extra: {
              zeroDurationSec: this.zeroBandwidthSamples * (STATS_UPDATE_INTERVAL / 1000),
              CPU: stats.CPU,
              droppedFrames: stats.numberDroppedFrames,
              percentageDroppedFrames: stats.percentageDroppedFrames,
              streamElapsedSec,
            },
          });
          this.zeroBandwidthAlertSent = true;
        }
      } else {
        if (this.zeroBandwidthAlertSent) {
          Sentry.addBreadcrumb({
            category: 'streaming',
            message: 'bandwidth recovered',
            data: {
              recoveryDurationSec: this.zeroBandwidthStartedAt
                ? Math.round((Date.now() - this.zeroBandwidthStartedAt) / 1000)
                : -1,
            },
          });
        }
        this.zeroBandwidthSamples = 0;
        this.zeroBandwidthAlertSent = false;
        this.zeroBandwidthStartedAt = null;
      }
    }
  }

  stop() {
    window.clearInterval(this.intervalId);
    this.ipcLostSubscription?.unsubscribe();
  }

  /**
   * OBS からフレーム統計（ラグ・レンダリング・スキップ・エンコード数）を取得する。
   * 取得に失敗した場合は null を返す（呼び出し元で前回値へフォールバックする）。
   */
  private readFrameStats(): {
    lagged: number;
    rendered: number;
    skipped: number;
    encoded: number;
  } | null {
    try {
      const stats = {
        lagged: obs.Global.laggedFrames,
        rendered: obs.Global.totalFrames,
        skipped: this.videoSettingsService.contexts.horizontal?.skippedFrames || 0,
        encoded: this.videoSettingsService.contexts.horizontal?.encodedFrames || 0,
      };
      this.frameStatsFailed = false;
      return stats;
    } catch (e) {
      if (isObsBackendIpcLost(e)) {
        this.obsIpcHealthService.notifyIpcLost('PerformanceService.readFrameStats');
        return null;
      }
      if (!this.frameStatsFailed) {
        this.frameStatsFailed = true;
        SentryReport.error('PerformanceService', 'readFrameStats', e, {
          extra: { lastObsOp: getLastObsOp() },
        });
      }
      return null;
    }
  }

  /**
   * サンプルを履歴配列に追加する（移動平均用）
   * 最大60サンプル（2分間）を保持
   */
  private addSample(record: number[], current: number): void {
    if (record.length >= this.NUMBER_OF_SAMPLES) {
      record.shift();
    }
    record.push(current);
  }

  /**
   * 履歴配列の平均値を計算する
   */
  private averageFactor(record: number[]): number {
    if (record.length === 0) return 0;
    return record.reduce((a, b) => a + b, 0) / record.length;
  }

  /**
   * 配信品質を計算する（GOOD/FAIR/POOR）
   * upstream と同じ閾値: 15% (POOR), 5% (FAIR)
   */
  private calculateStreamQuality(): StreamQuality {
    const avgDropped = this.averageFactor(this.historicalDroppedFrames);
    const avgLagged = this.averageFactor(this.historicalLaggedFrames);
    const avgSkipped = this.averageFactor(this.historicalSkippedFrames);

    const maxFactor = Math.max(avgDropped, avgLagged, avgSkipped);

    if (maxFactor >= 0.15) return 'POOR';
    if (maxFactor >= 0.05) return 'FAIR';
    return 'GOOD';
  }
}
