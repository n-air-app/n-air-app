import * as Sentry from '@sentry/vue';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Inject, mutation, PersistentStatefulService } from 'services/core';
import { $t } from 'services/i18n';
import { SettingsService } from 'services/settings';
import { ISourceFilter, SourceFiltersService } from 'services/source-filters';
import { NamedPipeClient } from 'services/substream/NamedPipeClient';

import { loudnessLevel, nextGainStep, nextQuiet } from './loudness-gain';

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
  showPanel: boolean;
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
  @Inject() private sourceFiltersService: SourceFiltersService;

  static defaultState: ILoudnessState = {
    targetLufs: -15,
    showPanel: true,
  };

  private client = new NamedPipeClient(PIPE_NAME);

  private loudnessSubject = new BehaviorSubject<ILoudness>(EMPTY_LOUDNESS);
  /** 配信トラックのラウドネス */
  loudness: Observable<ILoudness> = this.loudnessSubject.asObservable();

  private statusSubject = new BehaviorSubject<LoudnessStatus>('stopped');
  status: Observable<LoudnessStatus> = this.statusSubject.asObservable();

  private quietSubject = new BehaviorSubject<boolean>(false);
  /** 配信音声が小さい状態か (ミキサーの各ソースでゲインを案内する)。無音の間は直前の状態を保つ */
  quiet: Observable<boolean> = this.quietSubject.pipe(distinctUntilChanged());

  // 計測するか (enable / disable で切り替える)
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private meterId: number | null = null;
  private meterTrack: number | null = null;
  // enable/disable が連続しても start/stop が並行しないように直列化する
  private lifecycle: Promise<void> = Promise.resolve();

  get targetLufs(): number {
    return this.state.targetLufs;
  }

  get showPanel(): boolean {
    return this.state.showPanel ?? true;
  }

  setShowPanel(showPanel: boolean): void {
    this.SET_SHOW_PANEL(showPanel);
    // 再表示したときは、パネルの表示 (mount) で enable される
    if (!showPanel) this.disable();
  }

  @mutation()
  private SET_SHOW_PANEL(showPanel: boolean): void {
    this.state = { ...this.state, showPanel };
  }

  setTargetLufs(targetLufs: number): void {
    if (!Number.isFinite(targetLufs)) return;
    this.SET_TARGET_LUFS(targetLufs);
  }

  @mutation()
  private SET_TARGET_LUFS(targetLufs: number): void {
    this.state = { ...this.state, targetLufs };
  }

  /**
   * 計測を始める。パネルが表示されたときに呼ぶ (計測中なら何もしない。使えなかった場合は再接続を試す)。
   * パネルが作り直されても (コンパクトモードの切り替えなど) 計測を続けるため、パネルが消えても止めない。
   * 止めるのはパネルを非表示に設定したときだけ
   */
  enable(): void {
    this.running = true;
    this.lifecycle = this.lifecycle.then(() => this.start());
  }

  /** 計測を止める */
  disable(): void {
    if (!this.running) return;
    this.running = false;
    this.lifecycle = this.lifecycle.then(() => this.stop());
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
   * ゲイン (ゲインフィルタ) の現在値 (dB)。ユーザーが自分で追加したゲインフィルタも同じものとして扱う。
   * 複数あれば先頭のもの。ゲインフィルタがない、または無効なら 0
   */
  getGain(sourceId: string): number {
    const filter = this.findGainFilter(sourceId);
    return filter?.visible ? Number(filter.settings.db ?? 0) : 0;
  }

  /**
   * ゲインを設定する。ゲインフィルタがあれば値を更新し (無効なら有効にする)、なければ先頭 (他のフィルタより前) に追加する。
   * 0 にしてもゲインフィルタは削除しない (ユーザーが自分で追加したものかもしれないため)
   */
  setGain(sourceId: string, db: number): void {
    if (!Number.isFinite(db)) return;
    const existing = this.findGainFilter(sourceId);
    if (existing) {
      this.sourceFiltersService.updateSettings(sourceId, existing.name, { db });
      if (!existing.visible && db !== 0) this.sourceFiltersService.setVisibility(sourceId, existing.name, true);
      return;
    }
    if (db === 0) return;

    const name = this.sourceFiltersService.suggestName(sourceId, $t('filters.gain'));
    this.sourceFiltersService.add(sourceId, 'gain_filter', name, { db });
    const count = this.sourceFiltersService.getFilters(sourceId).length;
    if (count > 1) this.sourceFiltersService.setOrder(sourceId, name, -(count - 1));
  }

  /** ゲインを次の段階に上げ、上げた後の値を返す。上限に達していれば何もせず null */
  gainUp(sourceId: string): number | null {
    const next = nextGainStep(this.getGain(sourceId));
    if (next === null) return null;
    this.setGain(sourceId, next);
    return next;
  }

  private findGainFilter(sourceId: string): ISourceFilter | undefined {
    return this.sourceFiltersService.getFilters(sourceId).find((filter) => filter.type === 'gain_filter');
  }

  private async start(): Promise<void> {
    if (!this.running || this.meterId !== null) return;
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
    if (this.running) return;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    await this.destroyMeter();
    this.client.close();
    this.loudnessSubject.next(EMPTY_LOUDNESS);
    this.quietSubject.next(false);
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
    if (!this.running || this.meterId === null) return;

    try {
      // 出力設定で配信トラックが変わっていたらメーターを作り直す
      if (this.getStreamingTrack() !== this.meterTrack) {
        await this.destroyMeter();
        await this.createMeter();
      }
      const res = await this.call('get', { meterId: this.meterId });
      const loudness: ILoudness = {
        momentary: res.momentary ?? null,
        shortTerm: res.shortTerm ?? null,
        integrated: res.integrated ?? null,
        range: res.range ?? null,
      };
      this.loudnessSubject.next(loudness);
      const level = loudnessLevel(loudness.shortTerm, this.targetLufs);
      this.quietSubject.next(nextQuiet(this.quietSubject.getValue(), level));
    } catch (e) {
      this.reportUnavailable(e);
      return;
    }

    if (this.running) this.schedulePoll();
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
    this.quietSubject.next(false);
    if (this.statusSubject.getValue() === 'unavailable') return;
    this.statusSubject.next('unavailable');
    console.error('LoudnessService: nair-loudness is not available', e);
    Sentry.withScope((scope) => {
      scope.setFingerprint(['nair-loudness-unavailable']);
      Sentry.captureException(e);
    });
  }
}
