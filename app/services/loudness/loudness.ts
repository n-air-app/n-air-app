import * as Sentry from '@sentry/vue';
import { BehaviorSubject, Observable } from 'rxjs';
import { AudioService } from 'services/audio';
import { Inject, mutation, PersistentStatefulService } from 'services/core';
import { $t } from 'services/i18n';
import { SettingsService } from 'services/settings';
import { SourceFiltersService } from 'services/source-filters';
import { NamedPipeClient } from 'services/substream/NamedPipeClient';

import { IAdjustPlan, median, planAdjustment } from './loudness-adjust';

/**
 * nair-loudness.dll (n-air-app/loudness) と通信してラウドネスを取得する。
 * EBU R 128 / ITU-R BS.1770 準拠。単位は LUFS (range のみ LU)。
 * 値が確定していない (計測開始直後・無音) 項目は null。
 */
export interface ILoudness {
  momentary: number | null; // 400ms
  shortTerm: number | null; // 3s
  integrated: number | null; // 計測開始からの平均 (ゲート付き)
  range: number | null; // LRA
}

export type LoudnessStatus = 'stopped' | 'running' | 'unavailable';

interface ILoudnessState {
  // ガイドの目標値 (LUFS)。初期値はニコニコ動画のラウドネスノーマライゼーション基準と同じ -15
  targetLufs: number;
}

const PIPE_NAME = '\\\\.\\pipe\\NAirLoudness';
const POLL_INTERVAL_MS = 200;
const MEASURE_DURATION_MS = 8000;
// これ以下の momentary は無音 (声が出ていない) とみなす
const SILENCE_LUFS = -50;

const EMPTY_LOUDNESS: ILoudness = {
  momentary: null,
  shortTerm: null,
  integrated: null,
  range: null,
};

type RpcResult = { [name: string]: any };

export class LoudnessService extends PersistentStatefulService<ILoudnessState> {
  @Inject() private settingsService: SettingsService;
  @Inject() private audioService: AudioService;
  @Inject() private sourceFiltersService: SourceFiltersService;

  static defaultState: ILoudnessState = {
    targetLufs: -15,
  };

  private client = new NamedPipeClient(PIPE_NAME);

  private loudnessSubject = new BehaviorSubject<ILoudness>(EMPTY_LOUDNESS);
  /** 配信トラックのラウドネス */
  loudness: Observable<ILoudness> = this.loudnessSubject.asObservable();

  private statusSubject = new BehaviorSubject<LoudnessStatus>('stopped');
  status: Observable<LoudnessStatus> = this.statusSubject.asObservable();

  private enableCounter = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private meterId: number | null = null;
  private meterTrack: number | null = null;
  // enable/disable が連続しても start/stop が並行しないように直列化する
  private lifecycle: Promise<void> = Promise.resolve();

  get targetLufs(): number {
    return this.state.targetLufs;
  }

  setTargetLufs(targetLufs: number): void {
    if (!Number.isFinite(targetLufs)) return;
    this.SET_TARGET_LUFS(targetLufs);
  }

  @mutation()
  private SET_TARGET_LUFS(targetLufs: number): void {
    this.state = { ...this.state, targetLufs };
  }

  /** 計測の有効化 (ネスト対応)。表示するコンポーネントが mount 時に呼ぶ */
  enable(): void {
    this.enableCounter++;
    if (this.enableCounter > 1) return;
    this.lifecycle = this.lifecycle.then(() => this.start());
  }

  /** 計測の無効化 (ネスト対応)。表示するコンポーネントが unmount 時に呼ぶ */
  disable(): void {
    if (this.enableCounter <= 0) return;
    this.enableCounter--;
    if (this.enableCounter > 0) return;
    this.lifecycle = this.lifecycle.then(() => this.stop());
  }

  /** Integrated / LRA を含めて計測をやり直す */
  reset(): void {
    this.lifecycle = this.lifecycle.then(async () => {
      if (this.meterId === null) return;
      try {
        await this.call('reset', { meterId: this.meterId });
      } catch (e) {
        this.reportUnavailable(e);
      }
    });
  }

  /**
   * 配信に乗る音声トラック (0 始まり)。
   * obs-studio-node の createAudioStreamingEncoder() と同じ規則:
   * シンプルモードは 0 固定、詳細モードは AdvOut.TrackIndex - 1。
   * native の設定読み出しを避けるため、SettingsService の state (保存時に更新される) から読む
   */
  getStreamingTrack(): number {
    const output = this.settingsService.state.Output ?? {};
    if (output.Mode !== 'Advanced') return 0;
    const trackIndex = Number(output.TrackIndex);
    return Number.isInteger(trackIndex) && trackIndex >= 1 ? trackIndex - 1 : 0;
  }

  /**
   * 指定ソース単体のラウドネス (pre-fader、フィルタ適用後) を一定時間測り、有音区間の中央値を返す。
   * 声が出ていなければ null。配信用メーターとは別のメーターを一時的に作る
   */
  measureSource(sourceId: string, durationMs = MEASURE_DURATION_MS): Promise<number | null> {
    const run = async (): Promise<number | null> => {
      let meterId: number;
      try {
        const res = await this.call('create', { type: 'source', source: sourceId, postFader: false });
        meterId = res.meterId;
      } catch (e) {
        this.reportUnavailable(e);
        return null;
      }

      const samples: number[] = [];
      try {
        const endAt = Date.now() + durationMs;
        while (Date.now() < endAt) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          const res = await this.call('get', { meterId });
          // 無音区間 (声が出ていない) は目標との比較に使えないので除く
          if (typeof res.momentary === 'number' && res.momentary > SILENCE_LUFS) {
            samples.push(res.momentary);
          }
        }
      } catch (e) {
        this.reportUnavailable(e);
        return null;
      } finally {
        try {
          await this.call('destroy', { meterId });
        } catch {
          // 切断済みなら再接続時の destroyAll で片付く
        }
      }
      // 測定時間の 1/4 以上は有音でないと、声が出ていないとみなす
      const minSamples = Math.ceil(durationMs / POLL_INTERVAL_MS / 4);
      return samples.length >= minSamples ? median(samples) : null;
    };

    // 配信用メーターのポーリングと同じ接続を使うので、lifecycle で直列化する
    const result = this.lifecycle.then(run);
    this.lifecycle = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * 測定値 (measureSource の結果) を目標に合わせるよう、フェーダーとゲインフィルタを更新する。
   * ゲインフィルタが既にあれば値を更新し、なければ先頭 (他のフィルタより前) に追加する
   */
  applyAdjustment(sourceId: string, measuredLufs: number): IAdjustPlan {
    const audioSource = this.audioService.getSource(sourceId);
    if (!audioSource) throw new Error(`audio source not found: ${sourceId}`);

    const existing = this.sourceFiltersService
      .getFilters(sourceId)
      .find((filter) => filter.type === 'gain_filter');
    const currentGainDb = existing ? Number(existing.settings.db ?? 0) : null;

    const plan = planAdjustment({
      measuredLufs,
      targetLufs: this.targetLufs,
      faderDb: audioSource.fader.db,
      currentGainDb,
    });

    if (plan.gainDb !== null) {
      if (existing) {
        this.sourceFiltersService.updateSettings(sourceId, existing.name, { db: plan.gainDb });
      } else {
        const name = this.sourceFiltersService.suggestName(sourceId, $t('filters.gain'));
        this.sourceFiltersService.add(sourceId, 'gain_filter', name, { db: plan.gainDb });
        const count = this.sourceFiltersService.getFilters(sourceId).length;
        if (count > 1) this.sourceFiltersService.setOrder(sourceId, name, -(count - 1));
      }
    }
    // 10^(dB/20)。フェーダーは mul (線形) で設定する (db は直接設定しない)
    audioSource.setMul(Math.pow(10, plan.faderDb / 20));
    return plan;
  }

  private async start(): Promise<void> {
    if (this.enableCounter <= 0) return;
    try {
      // 前回の接続で作ったメーターが残っていても、ここで掃除する
      await this.call('destroyAll');
      await this.createMeter();
    } catch (e) {
      this.reportUnavailable(e);
      return;
    }
    this.statusSubject.next('running');
    this.schedulePoll();
  }

  private async stop(): Promise<void> {
    if (this.enableCounter > 0) return;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    await this.destroyMeter();
    this.client.close();
    this.loudnessSubject.next(EMPTY_LOUDNESS);
    if (this.statusSubject.getValue() !== 'unavailable') {
      this.statusSubject.next('stopped');
    }
  }

  private async createMeter(): Promise<void> {
    const track = this.getStreamingTrack();
    const res = await this.call('create', { type: 'track', track });
    this.meterId = res.meterId;
    this.meterTrack = track;
  }

  private async destroyMeter(): Promise<void> {
    if (this.meterId === null) return;
    const meterId = this.meterId;
    this.meterId = null;
    this.meterTrack = null;
    try {
      await this.call('destroy', { meterId });
    } catch {
      // 切断済みならプラグイン側の再接続時に destroyAll で片付く
    }
  }

  private schedulePoll(): void {
    // poll も start/stop と同じ lifecycle で直列化し、stop の途中でメーターを触らないようにする
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      this.lifecycle = this.lifecycle.then(() => this.poll());
    }, POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    if (this.enableCounter <= 0 || this.meterId === null) return;

    try {
      // 出力設定で配信トラックが変わっていたらメーターを作り直す
      if (this.getStreamingTrack() !== this.meterTrack) {
        await this.destroyMeter();
        await this.createMeter();
      }
      const res = await this.call('get', { meterId: this.meterId });
      this.loudnessSubject.next({
        momentary: res.momentary ?? null,
        shortTerm: res.shortTerm ?? null,
        integrated: res.integrated ?? null,
        range: res.range ?? null,
      });
    } catch (e) {
      this.reportUnavailable(e);
      return;
    }

    if (this.enableCounter > 0) this.schedulePoll();
  }

  private async call(fn: string, arg: RpcResult = {}): Promise<RpcResult> {
    const res = await this.client.callEx(fn, arg);
    if (res.error) throw new Error(`nair-loudness ${fn}: ${res.error}`);
    return res;
  }

  // nair-loudness.dll はアプリに同梱するため、接続できないのは異常。Sentry に送る
  private reportUnavailable(e: unknown): void {
    this.meterId = null;
    this.meterTrack = null;
    this.client.close();
    this.loudnessSubject.next(EMPTY_LOUDNESS);
    if (this.statusSubject.getValue() === 'unavailable') return;
    this.statusSubject.next('unavailable');
    console.error('LoudnessService: nair-loudness is not available', e);
    Sentry.withScope((scope) => {
      scope.setFingerprint(['nair-loudness-unavailable']);
      Sentry.captureException(e);
    });
  }
}
