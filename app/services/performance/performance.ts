import Vue from 'vue';

import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';
import { Inject } from 'services/core/injector';
import { StatefulService, mutation } from 'services/core/stateful-service';
import { CustomizationService } from 'services/customization';
import { VideoSettingsService } from 'services/settings-v2/video';
import { EStreamingState, StreamingService } from 'services/streaming';
import { getKeys } from 'util/getKeys';
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

  // 移動平均用の履歴配列
  private historicalDroppedFrames: number[] = [];
  private historicalSkippedFrames: number[] = [];
  private historicalLaggedFrames: number[] = [];
  private readonly NUMBER_OF_SAMPLES = 60; // 60 × 2秒 = 2分

  @mutation()
  SET_PERFORMANCE_STATS(stats: Partial<IPerformanceState>) {
    getKeys(stats).forEach(stat => {
      Vue.set(this.state, stat, stats[stat]);
    });
  }

  init() {
    this.intervalId = window.setInterval(() => this.update(), STATS_UPDATE_INTERVAL);

    // 配信状態の変化を監視して履歴をリセット
    this.streamingService.streamingStatusChange.subscribe(status => {
      if (status === EStreamingState.Live) {
        this.historicalDroppedFrames = [];
        this.historicalLaggedFrames = [];
        this.historicalSkippedFrames = [];
      }
    });
  }

  private getState(): IPerformanceState {
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
      if (this.statsFailed) {
        // Sentryイベント数削減のため、2回目以降はbreadcrumbsに記録する
        Sentry.addBreadcrumb({
          category: 'performance.getState',
          message: e.toString(),
          level: 'warning',
        });
      } else {
        Sentry.captureException(e);
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
      .map(proc => {
        return proc.cpu.percentCPUUsage;
      })
      .reduce((sum, usage) => sum + usage);

    // OBS からフレーム統計を取得
    const currentLaggedFrames = obs.Global.laggedFrames;
    const currentRenderedFrames = obs.Global.totalFrames;
    const currentSkippedFrames = this.videoSettingsService.contexts.horizontal?.skippedFrames || 0;
    const currentEncodedFrames = this.videoSettingsService.contexts.horizontal?.encodedFrames || 0;

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
  }

  stop() {
    window.clearInterval(this.intervalId);
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
