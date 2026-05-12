import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';
import { Inject } from 'services/core/injector';
import { Service } from 'services/core/service';
import { getCookieDomain, transformUrl } from 'services/dev-hosts';
import { HostsService } from 'services/hosts';
import { isOk, NicoliveClient } from 'services/nicolive-program/NicoliveClient';
import { SettingsService } from 'services/settings';
import { EStreamingState, StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { WindowsService } from 'services/windows';
import { FakeUserAuth, isFakeMode } from 'util/fakeMode';
import { fetchViaMainProcess } from 'util/fetchViaMainProcess';
import { authorizedHeaders, handleErrors } from 'util/requests';
import { RequestError } from 'util/RequestError';
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
    const { url, init } = this.sessionsMeParams();
    const response = await fetch(url, init);
    if (response.status === 400 || response.status === 401) {
      return '';
    }
    const response_1 = await handleErrors(response); // !response.ok を例外にする
    const json = await response_1.json();
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
    return this.userService.platform.token;
  }

  get niconicoUserId() {
    return this.userService.platform.id;
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
        this.client.fetchIngestInfo(this.channelId).catch(() => {
          console.log('niconico program has ended! stopping streaming.');
          this.streamingService.stopStreaming();
        });
      }
    });
  }

  /**
   * 有効な番組が選択されていれば、stream URL/key を設定し、その値を返す。
   * そうでなければ、ダイアログを出して選択を促すか、配信していない旨返す。
   * @param programId ユーザーが選択した番組ID(省略は未選択)
   */
  async setupStreamSettings(programId: string): Promise<IStreamingSetting> {
    try {
      // 直接returnしてしまうとcatchできないので一度awaitで受ける
      const result = await this._setupStreamSettings(programId);
      return result;
    } catch (e) {
      console.error('NiconicoService.setupStreamSettings(1)', e.toString());
      // APIのレスポンスに番組状態が反映されるのが遅れる場合があるので、少し待ってリトライ
      await sleep(3000);
    }

    try {
      const result = await this._setupStreamSettings(programId);
      return result;
    } catch (e) {
      // リトライは1回だけ
      console.error('NiconicoService.setupStreamSettings(2)', e.toString());
      Sentry.addBreadcrumb({
        category: 'streaming',
        message: 'setupStreamSettings failed',
        data: {
          programId,
          error: e instanceof Error ? e.message : String(e),
          isNetworkError: e instanceof TypeError,
        },
      });
      return NiconicoService.emptyStreamingSetting();
    }
  }

  private async _setupStreamSettings(programId: string): Promise<IStreamingSetting> {
    const [stream, quality] = await Promise.all([
      this.client.fetchIngestInfo(programId),
      this.client.fetchMaxQuality(programId),
    ]);
    if (!isOk(stream)) {
      return Promise.reject(stream.value);
    }

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
    this.settingsService.setSettings('Stream', settings);

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
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers });

    const response = await fetch(request);
    const response_1 = await handleErrors(response);
    const response_2 = await response_1.json();
    return this.userService.updatePlatformToken(response_2.access_token);
  }
}
