import * as Sentry from '@sentry/vue';
import { BehaviorSubject, Observable } from 'rxjs';
import { Inject, mutation, PersistentStatefulService } from 'services/core';
import { SettingsService } from 'services/settings';
import { NamedPipeClient } from 'services/substream/NamedPipeClient';

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

const EMPTY_LOUDNESS: ILoudness = {
  momentary: null,
  shortTerm: null,
  integrated: null,
  range: null,
};

type RpcResult = { [name: string]: any };

export class LoudnessService extends PersistentStatefulService<ILoudnessState> {
  @Inject() private settingsService: SettingsService;

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
