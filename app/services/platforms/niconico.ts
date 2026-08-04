import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';
import { Inject } from 'services/core/injector';
import { Service } from 'services/core/service';
import { getCookieDomain, transformUrl } from 'services/dev-hosts';
import { HostsService } from 'services/hosts';
import { isOk, NicoliveClient } from 'services/nicolive-program/NicoliveClient';
import { NicoliveFailure } from 'services/nicolive-program/NicoliveFailure';
import { SettingsService } from 'services/settings';
import { EStreamingState, StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { WindowsService } from 'services/windows';
import { FakeUserAuth, isFakeMode } from 'util/fakeMode';
import { fetchViaMainProcess } from 'util/fetchViaMainProcess';
import { RequestError } from 'util/RequestError';
import { authorizedHeaders, handleErrors } from 'util/requests';
import { SentryReport } from 'util/sentry-report';
import { sleep } from 'util/sleep';

import { IPlatformService, IStreamingSetting } from '.';
import { FrontendIdHeader } from './niconicoDefs';

// /v1/sessions/me のレスポンス型
type NiconicoSessionsMeResponse =
  | {
    user: {
      id: number;
    };
  }
  | {
    error: {
      status: number;
      code: string;
      message?: string;
      debug?: string;
    };
  };

function isSessionsMeResponse(obj: any): obj is NiconicoSessionsMeResponse {
  if ('user' in obj) {
    return typeof obj.user.id === 'number';
  } else if ('error' in obj) {
    return typeof obj.error.status === 'number' && typeof obj.error.code === 'string';
  }
  return false;
}

export class NiconicoService extends Service implements IPlatformService {
  @Inject() hostsService: HostsService;
  @Inject() settingsService: SettingsService;
  @Inject() userService: UserService;
  @Inject() streamingService: StreamingService;
  @Inject() windowsService: WindowsService;

  authWindowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 800,
    height: 800,
  };

  client: NicoliveClient = new NicoliveClient();

  private sessionsMeParams(
    method: string = 'GET',
    extraHeaders?: Record<string, string>,
  ): { url: string; init: RequestInit } {
    const url = this.hostsService.replaceHost(`${this.hostsService.niconicoId}/v1/sessions/me`);
    return {
      url,
      init: {
        method,
        credentials: 'same-origin',
        headers: { ...FrontendIdHeader, ...extraHeaders },
      },
    };
  }

  async getUserId(): Promise<string> {
    if (isFakeMode()) {
      return FakeUserAuth.platform.id; // dummy user ID
    }
    // renderer の fetch では app 起点がクロスサイト扱いとなり、SameSite=Lax の
    // user_session が自動付与されない。logout と同様に cookie を明示して main 経由で送る。
    const { session } = remote.getCurrentWebContents();
    const cookies = await session.cookies.get({
      url: `https://${getCookieDomain()}`,
      name: 'user_session',
    });
    if (cookies.length < 1) {
      return '';
    }
    const { url, init } = this.sessionsMeParams('GET', {
      Cookie: `user_session=${cookies[0].value}`,
    });
    const response = await fetchViaMainProcess(url, init);
    if (response.status === 400 || response.status === 401) {
      return '';
    }
    if (!response.ok) {
      // オフライン等は例外にし、validateLogin 側で LOGOUT しない
      throw new RequestError(response.status, url, 'GET');
    }
    let json: unknown;
    try {
      json = JSON.parse(response.text);
    } catch (e) {
      console.error('NiconicoService.getUserId: invalid JSON response', response.text);
      return '';
    }
    if (isSessionsMeResponse(json)) {
      if ('user' in json) {
        return json.user.id.toString();
      }
    } else {
      console.error('NiconicoService.getUserId: invalid response', json);
    }
    return '';
  }

  async isLoggedIn(): Promise<boolean> {
    const id = await this.getUserId();
    return id !== '';
  }

  async isPremium(token: string): Promise<boolean> {
    if (isFakeMode()) {
      return true;
    }
    try {
      const url = `${this.hostsService.niconicoOAuth}/v1/user/premium.json`;
      const headers = authorizedHeaders(token);
      const request = new Request(this.hostsService.replaceHost(url), { headers });
      const res = await fetch(request);
      const { data } = await res.json();
      return data?.type === 'premium';
    } catch (e) {
      console.warn('[isPremium] Failed to check premium status:', e);
      return false;
    }
  }

  async logout(): Promise<void> {
    if (isFakeMode()) {
      return;
    }
    const { session } = remote.getCurrentWebContents();
    const cookies = await session.cookies.get({
      url: `https://${getCookieDomain()}`,
      name: 'user_session',
    });
    if (cookies.length < 1) {
      return; // セッションクッキーがない場合はすでにログアウト済
    }
    const { url, init } = this.sessionsMeParams('DELETE', {
      Origin: transformUrl('https://n-air-app.nicovideo.jp'),
      Cookie: `user_session=${cookies[0].value}`,
    });
    const response = await fetchViaMainProcess(url, init);
    Sentry.addBreadcrumb({
      category: 'niconico',
      message: `logout: ${response.status}`,
    });
    if (!response.ok) {
      throw new RequestError(response.status, url, 'DELETE');
    }
  }

  get authUrl() {
    const host = this.hostsService.nAirLogin;
    return host;
  }

  get userSession() {
    return this.userService.apiToken;
  }

  get oauthToken() {
    return this.userService.platform!.token;
  }

  get niconicoUserId() {
    return this.userService.platform!.id;
  }

  /** 配信中番組ID
   */
  get channelId() {
    return this.userService.channelId;
  }
  getMyPageURL(): string {
    return this.hostsService.getMyPageURL();
  }
  getHeaders(authorized = false): Headers {
    const headers = new Headers();
    return headers;
  }

  get streamingStatus() {
    return this.streamingService.state.streamingStatus;
  }

  init() {
    console.log('niconico.init');
    this.streamingService.streamingStatusChange.subscribe(() => {
      console.log('streamingService.streamingStatusChange! ', this.streamingStatus);
      if (this.streamingStatus === EStreamingState.Reconnecting) {
        console.log('reconnecting - checking stream key');
        this.client.fetchIngestInfo(this.channelId!).catch(() => {
          console.log('niconico program has ended! stopping streaming.');
          this.streamingService.stopStreaming();
        });
      }
    });
  }

  /** setupStreamSettings の Sentry 報告を抑制するための 2 段 quota ガード状態 */
  private static readonly SETUP_REPORT_WINDOW_MS = 60_000;
  private static readonly SETUP_REPORT_MAX_PER_KEY = 5;
  private static readonly setupReportState = new Map<string, { count: number; last: number | null }>();

  /**
   * 有効な番組が選択されていれば、stream URL/key を設定し、その値を返す。
   * そうでなければ、ダイアログを出して選択を促すか、配信していない旨返す。
   * @param programId ユーザーが選択した番組ID(省略は未選択)
   * @returns 成功時は IStreamingSetting。失敗時は空 setting を返し、failure を lastSetupFailure に保持する。
   */
  lastSetupFailure: NicoliveFailure | null = null;

  async setupStreamSettings(programId: string): Promise<IStreamingSetting> {
    this.lastSetupFailure = null;
    try {
      // 直接returnしてしまうとcatchできないので一度awaitで受ける
      const result = await this._setupStreamSettings(programId);
      return result;
    } catch (e) {
      // APIのレスポンスに番組状態が反映されるのが遅れる場合があるので、少し待ってリトライ
      // 1回目失敗はbreadcrumbのみ(issue化しない)
      Sentry.addBreadcrumb({
        category: 'streaming',
        message: 'setupStreamSettings(1) failed',
        data: {
          programId,
          step: e instanceof NicoliveFailure ? e.method : 'unknown',
          error: e instanceof Error ? e.message : String(e),
        },
      });
      await sleep(3000);
    }

    try {
      const result = await this._setupStreamSettings(programId);
      return result;
    } catch (e) {
      // リトライは1回だけ — 失敗種別を構造化してSentryに報告する
      const isNicoliveFailure = e instanceof NicoliveFailure;
      const failure = isNicoliveFailure
        ? e
        : new NicoliveFailure('network_error', 'unknown', 'unknown');
      this.lastSetupFailure = failure;

      const step = failure.method;
      const failureKind = failure.failureKind ?? failure.reason;
      const httpStatus = failure.type === 'http_error' ? failure.reason : '';
      const errorCode = failure.errorCode ?? '';
      const route = failure.route ?? 'renderer';

      // NicoliveFailure は Error を継承していないため、String(e) では
      // "[object Object]" になってしまう。e が NicoliveFailure の場合は
      // additionalMessage に元の native例外メッセージが入っていることが多いが、
      // NicoliveFailure.fromClientError の network_error/json_parse/not_logged_in
      // 分岐では additionalMessage が常に空文字になる(元のメッセージを保持しない)ため、
      // その場合は type/reason で最低限の診断情報を残す
      let errorMessage: string;
      if (isNicoliveFailure) {
        errorMessage = failure.additionalMessage || `${failure.type}:${failure.reason}`;
      } else if (e instanceof Error) {
        errorMessage = e.message;
      } else {
        errorMessage = String(e);
      }

      Sentry.addBreadcrumb({
        category: 'streaming',
        message: 'setupStreamSettings(2) failed',
        data: {
          programId,
          step,
          failureKind,
          route,
          httpStatus,
          errorCode,
        },
      });

      // 2段quotaガード: セッション内最大5件、60秒に1件
      const quotaKey = `setupStreamSettings:${step}:${failureKind}`;
      const state = NiconicoService.setupReportState.get(quotaKey) ?? { count: 0, last: null };
      const now = Date.now();
      if (
        state.count < NiconicoService.SETUP_REPORT_MAX_PER_KEY
        && (state.last === null || now - state.last >= NiconicoService.SETUP_REPORT_WINDOW_MS)
      ) {
        state.count += 1;
        state.last = now;
        NiconicoService.setupReportState.set(quotaKey, state);
        const capReached = state.count >= NiconicoService.SETUP_REPORT_MAX_PER_KEY;

        SentryReport.message(
          'NiconicoService',
          'setupStreamSettings',
          // NOISE文字列を含まない固定書式(beforeSendに捕捉されないよう network_error にアンダースコアを使用)
          `setupStreamSettings failed at ${step} (${failureKind})`,
          {
            level: 'error',
            fingerprint: ['NiconicoService', 'setupStreamSettings', step, failureKind, httpStatus],
            tags: {
              diagnostic: 'stream-setup',
              'stream.setup.step': step,
              'stream.setup.failureKind': failureKind,
              'stream.setup.route': route,
              ...(httpStatus ? { 'stream.setup.httpStatus': httpStatus } : {}),
              ...(errorCode ? { 'stream.setup.errorCode': errorCode } : {}),
            },
            extra: {
              programId,
              errorMessage,
              additionalMessage: failure.additionalMessage,
              reportCount: state.count,
              ...(capReached ? { reportCapReached: true } : {}),
            },
          },
        );
      }

      return NiconicoService.emptyStreamingSetting();
    }
  }

  /**
   * ストリーム設定を試みる。失敗した場合は NicoliveFailure を throw する。
   * ステップを特定するために fetchIngestInfo, fetchMaxQuality, setSettings を個別に扱う。
   */
  private async _setupStreamSettings(programId: string): Promise<IStreamingSetting> {
    // Promise.allSettled で並列取得し、失敗したステップを特定する
    const [streamResult, qualityResult] = await Promise.allSettled([
      this.client.fetchIngestInfo(programId),
      this.client.fetchMaxQuality(programId),
    ]);

    // ingest 情報の取得失敗はリトライ対象かつ致命的
    if (streamResult.status === 'rejected') {
      const err = streamResult.reason;
      throw err instanceof NicoliveFailure
        ? err
        : new NicoliveFailure('network_error', 'fetchIngestInfo', 'network_error');
    }
    const stream = streamResult.value;
    if (!isOk(stream)) {
      throw NicoliveFailure.fromClientError('fetchIngestInfo', stream);
    }

    // quality の取得失敗は致命的でない(fetchMaxQuality は内部でfallback値を返す)
    // rejected になることは基本ないが、念のため breadcrumb に残す
    if (qualityResult.status === 'rejected') {
      Sentry.addBreadcrumb({
        category: 'streaming',
        message: 'fetchMaxQuality rejected (non-fatal)',
        data: { programId, error: String(qualityResult.reason) },
      });
    }
    const quality = qualityResult.status === 'fulfilled' ? qualityResult.value : undefined;

    const url = stream.value.rtmp.tcUrl;
    const key = stream.value.rtmp.streamName;

    const settings = this.settingsService.getSettingsFormData('Stream');
    settings.forEach((subCategory) => {
      if (subCategory.nameSubCategory !== 'Untitled') return;
      subCategory.parameters.forEach((parameter) => {
        switch (parameter.name) {
          case 'service':
            parameter.value = 'niconico ニコニコ生放送';
            break;
          case 'server':
            parameter.value = url;
            break;
          case 'key':
            parameter.value = key;
            break;
        }
      });
    });

    try {
      this.settingsService.setSettings('Stream', settings);
    } catch (e) {
      // setSettings 失敗は NicoliveFailure でラップしてステップを明示する
      throw new NicoliveFailure(
        'network_error',
        'setSettings',
        'set_settings_failed',
        e instanceof Error ? e.message : String(e),
      );
    }

    // 有効な番組が選択されているので stream keyを返す
    return NiconicoService.createStreamingSetting(url, key, quality);
  }

  private static emptyStreamingSetting(): IStreamingSetting {
    return NiconicoService.createStreamingSetting('', '');
  }

  private static createStreamingSetting(
    url: string,
    key: string,
    quality?:
      | {
        bitrate: number;
        height: number;
        fps: number;
      }
      | undefined,
  ): IStreamingSetting {
    return { url, key, quality };
  }

  // TODO ニコニコOAuthのtoken更新に使う
  async fetchNewToken(): Promise<void> {
    const url = `${this.hostsService.niconicoOAuth}/oauth2/token`;
    const headers = authorizedHeaders(this.userService.apiToken!);
    const request = new Request(url, { headers });

    const response = await fetch(request);
    const response_1 = await handleErrors(response);
    const response_2 = await response_1.json();
    return this.userService.updatePlatformToken(response_2.access_token);
  }
}
