import { sleep } from '../../util/sleep';
import { PersistentStatefulService } from '../core/persistent-stateful-service';
import { mutation } from '../core/stateful-service';
import { $t } from '../i18n';

import { NamedPipeClient } from './NamedPipeClient';

type Primitive = string | number | boolean;

/** タブID型 */
export type SubStreamTabID = 'youtube' | 'twitch' | 'other';

/** タブごとのURL/キー設定 */
interface TabSettings {
  url: string;
  key: string;
}

/** サブストリームの設定状態を表すインターフェース */
interface ISubStreamState {
  use: boolean;
  url: string;
  key: string;
  selectedTab: SubStreamTabID;
  tabs: {
    youtube: TabSettings;
    twitch: TabSettings;
    other: TabSettings;
  };
  videoBitrate: number;
  audioBitrate: number;
  videoCodec: string;
  keyintSec: number; // キーフレーム間隔（秒）0:auto default:2
  audioCodec: string;
  sync: boolean;
}

/** エンコーダータイプの列挙結果を表すインターフェース */
interface EnumEncoderTypesResult {
  encoders: {
    video: { id: string; name: string }[];
    audio: { id: string; name: string }[];
  };
}

/** ストリーム開始パラメータを表すインターフェース */
export interface StartParam {
  videoId: string;
  audioId: string;
  output: { [name: string]: Primitive };
  service: { key: string; server: string;[name: string]: Primitive };
  video: { bitrate: number; keyint_sec: number;[name: string]: Primitive };
  audio: { bitrate: number;[name: string]: Primitive };
}

/** サブストリームの状態値を表す型 */
export declare type SubStreamStatusValue =
  | 'stopped'
  | 'stopping'
  | 'started'
  | 'starting'
  | 'reconnect'
  | 'reconnected'
  | 'deactive'
  | 'unknown';

/** サブストリームのステータスを表すインターフェース */
export interface SubStreamStatus {
  active: boolean;
  status: SubStreamStatusValue;
  error: string;
  busy: boolean;
  streaming: boolean;
  duration?: number;
  connectTime?: number;
  bytes?: number;
  frames?: number;
  congestion?: number;
  dropped?: number;
  displayStatus: string;
}

type WaitForStreamStateResult = 'ready' | 'state-mismatch' | 'timeout';

const SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * サブストリーム配信機能を管理するサービスクラス
 * 名前付きパイプを使用して外部プロセスと通信し、サブストリームの制御を行う
 */
export class SubStreamService extends PersistentStatefulService<ISubStreamState> {
  client = new NamedPipeClient('\\\\.\\pipe\\NAirSubstream');

  static defaultState: ISubStreamState = {
    use: false,
    url: '',
    key: '',
    selectedTab: 'youtube',
    tabs: {
      youtube: { url: '', key: '' },
      twitch: { url: '', key: '' },
      other: { url: '', key: '' },
    },
    videoBitrate: 2500,
    audioBitrate: 128,
    videoCodec: 'h264',
    keyintSec: 2,
    audioCodec: 'aac',
    sync: false,
  };

  isExecutingCommand = false; // コマンド実行中フラグ

  init() {
    super.init();
    // 旧フォーマット（tabs に値がない = url/key のみのデータ）からのマイグレーション
    // PersistentStatefulService は defaultState と永続化データを deep merge するため、
    // selectedTab は常に defaultState の値が入る。代わりに全タブが空かつ url が設定済みかで判定する。
    const allTabsEmpty = Object.values(this.state.tabs).every((t) => !t.url && !t.key);
    if (allTabsEmpty && this.state.url) {
      const tabCandidates: SubStreamTabID[] = ['youtube', 'twitch'];
      const tab: SubStreamTabID = tabCandidates.find((t) => this.state.url.includes(t)) ?? 'other';
      this.setState({
        selectedTab: tab,
        tabs: {
          ...this.state.tabs,
          [tab]: { url: this.state.url, key: this.state.key },
        },
      });
    }
  }

  @mutation()
  private SET_STATE(nextState: ISubStreamState) {
    this.state = nextState;
  }

  setState(param: Partial<ISubStreamState>) {
    const nextState = { ...this.state, ...param };
    this.SET_STATE(nextState);
  }

  /**
   * サブストリームの配信を開始する
   * 設定されたURLとキーを使用して配信を開始する
   */
  async start(): Promise<string | undefined> {
    if (!this.state) this.setState(SubStreamService.defaultState);
    if (!this.state.use) return;
    if (!this.state.url.startsWith('rtmp') || !this.state.key) return $t('settings.substream.error.url_key');

    const bitRange = (value: any, min: number, max: number): number =>
      Math.max(min, Math.min(Math.floor(Number(value)), max));

    const param: StartParam = {
      videoId: this.state.videoCodec, //'obs_x264',
      audioId: this.state.audioCodec, //'ffmpeg_aac',
      output: {
        low_latency_mode_enabled: true,
        // "bind_ip": "default",
        // "drop_threshold_ms": 700,
        // "max_shutdown_time_sec": 30,
        // "new_socket_loop_enabled": false,
        // "pframe_drop_threshold_ms": 900
      },
      service: {
        key: this.state.key,
        server: this.state.url,
      },
      video: {
        bitrate: bitRange(this.state.videoBitrate, 200, 100000), // 2500
        keyint_sec: bitRange(this.state.keyintSec, 0, 20), // 0
        // "buffer_size": 2500,
        // "crf": 23,
        // "preset": "veryfast",
        // "profile": "",
        // "rate_control": "CBR",
        // "repeat_headers": false,
        // "tune": "",
        // "use_bufsize": false,
        // "x264opts": ""
      },
      audio: {
        bitrate: bitRange(this.state.audioBitrate, 64, 320), //128,
      },
    };

    // コマンドの連続実行防止
    if (this.isExecutingCommand) return $t('settings.substream.error.command_in_progress');
    this.isExecutingCommand = true;
    try {
      const waitResult = await this.waitForStreamState(false);
      if (waitResult === 'state-mismatch') {
        // 既に配信中の場合、開始操作は完了済みとして扱う。
        return;
      }
      if (waitResult === 'timeout') {
        return $t('settings.substream.error.busy_timeout');
      }

      const response = await this.client.callEx('start', param);
      if (response.error) {
        return `${$t('settings.substream.error.start_failed')}: ${response.error}`;
      }
    } catch (err) {
      console.error('Failed to start substream:', err);
      return $t('settings.substream.error.communication_failed');
    } finally {
      this.isExecutingCommand = false;
    }
  }

  /**
   * サブストリームの配信を停止する
   */
  async stop(): Promise<string | undefined> {
    // 連投防止
    if (this.isExecutingCommand) return $t('settings.substream.error.command_in_progress');
    this.isExecutingCommand = true;
    try {
      const waitResult = await this.waitForStreamState(true);
      if (waitResult === 'ready') {
        const response = await this.client.callEx('stop');
        if (response.error) return `${$t('settings.substream.error.stop_failed')}: ${response.error}`;
      } else if (waitResult === 'timeout') {
        return $t('settings.substream.error.busy_timeout');
      }
    } catch (err) {
      console.error('Failed to stop substream:', err);
      return $t('settings.substream.error.communication_failed');
    } finally {
      this.isExecutingCommand = false;
    }
  }

  /**
   * アプリ終了時にサブストリームを停止し、OBSリソースの解放完了を待つ
   *
   * @throws 停止状態を確認できない、またはタイムアウトした場合
   */
  async shutdown(): Promise<void> {
    const timeoutAt = Date.now() + SHUTDOWN_TIMEOUT_MS;

    try {
      let status = await this.getStatusForShutdown();

      while (status.busy && Date.now() < timeoutAt) {
        await sleep(100);
        status = await this.getStatusForShutdown();
      }

      if (status.busy) throw new Error('SubStream was busy during shutdown');

      if (status.active || status.streaming) {
        const response = await this.client.callEx('stop');
        if (response.error) throw new Error(`Failed to stop SubStream: ${response.error}`);
      }

      while (Date.now() < timeoutAt) {
        status = await this.getStatusForShutdown();
        if (!status.active && !status.streaming && !status.busy) return;
        await sleep(100);
      }

      throw new Error('Timed out waiting for SubStream to stop');
    } finally {
      this.client.close();
    }
  }

  private async getStatusForShutdown(): Promise<SubStreamStatus> {
    return (await this.client.callEx('status')) as SubStreamStatus;
  }

  /**
   * 利用可能なエンコーダータイプの一覧を取得する
   */
  async enumEncoderTypes(): Promise<EnumEncoderTypesResult> {
    const encoderTypes = (await this.client.callEx('enumEncoderTypes')) as EnumEncoderTypesResult;
    if (!encoderTypes.encoders?.video?.length || !encoderTypes.encoders?.audio?.length) {
      throw new Error('Invalid encoder list response');
    }
    return encoderTypes;
  }

  /**
   * 現在のストリームステータスを取得する
   */
  async getStatus(): Promise<SubStreamStatus> {
    const streamStatus = (await this.client.call('status')) as SubStreamStatus;
    if (!streamStatus) {
      return {
        status: 'unknown',
        displayStatus: 'internal error',
        active: false,
        busy: false,
        streaming: false,
        error: 'not connected',
      };
    }

    const statusMap: { [name: string]: string } = {
      starting: $t('settings.substream.status.starting'),
      started: $t('settings.substream.status.started'),
      stopping: $t('settings.substream.status.stopping'),
      stopped: $t('settings.substream.status.stopped'),
      reconnect: $t('settings.substream.status.reconnect'),
      reconnected: $t('settings.substream.status.reconnected'),
      deactive: $t('settings.substream.status.deactive'),
    };

    const errorMap: { [name: string]: string } = {
      'bad path': $t('settings.substream.error.bad_path'),
      'connect failed': $t('settings.substream.error.connect_failed'),
      'invalid stream': $t('settings.substream.error.invalid_stream'),
    };

    streamStatus.displayStatus = (statusMap[streamStatus.status] || '')
      + (streamStatus.error ? `: ${errorMap[streamStatus.error] || streamStatus.error}` : '');
    //console.log('status:', JSON.stringify(streamStatus));
    return streamStatus;
  }

  /**
   * サブストリームが準備完了状態になるまで待機する
   * @param streaming 待機する状態（true: ストリーミング中、false: 停止中）
   * @returns 指定された状態になったかどうか
   */
  private async waitForStreamState(streaming: boolean): Promise<WaitForStreamStateResult> {
    const timeoutAt = Date.now() + 30000; // 30秒タイムアウト

    while (Date.now() < timeoutAt) {
      const status = (await this.client.callEx('status')) as SubStreamStatus;
      if (!status.busy) return status.streaming === streaming ? 'ready' : 'state-mismatch';
      await sleep(500); // 500ms待機
    }
    return 'timeout';
  }

  /**
   * 同期設定が有効な場合にサブストリーム配信を開始する
   * メインストリームと同期して使用される
   */
  async syncStart() {
    if (!this.state.sync) return;
    await this.start();
  }

  /**
   * 同期設定が有効な場合にサブストリーム配信を停止する
   * メインストリームと同期して使用される
   */
  async syncStop() {
    if (!this.state.sync) return;
    await this.stop();
  }
}
