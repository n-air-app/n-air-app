import Utils from 'services/utils';
import { Service } from './core/service';
import { isDevHosts, transformUrl } from './dev-hosts';

// Hands out hostnames to the rest of the app. Eventually
// we should allow overriding this value. But for now we
// are just keeping the value in one place.
export class HostsService extends Service {
  useDevServer: boolean = !!process.env.DEV_SERVER;
  replaceHost(url: string) {
    // dev-hosts config takes priority over DEV_SERVER localhost proxy
    if (isDevHosts()) return url;
    if (this.useDevServer) {
      if (url.startsWith(this.niconicoAccount)) {
        return url.replace(this.niconicoAccount, 'http://localhost:8080/account');
      }
      if (url.startsWith(this.niconicoId)) {
        return url.replace(this.niconicoId, 'http://localhost:8080/id');
      }
      if (url.startsWith(this.niconicoOAuth)) {
        return url.replace(this.niconicoOAuth, 'http://localhost:8080/oauth');
      }
      if (url.startsWith(this.blogNicovideo)) {
        return url.replace(this.blogNicovideo, 'http://localhost:8080/blog');
      }
    }
    return url;
  }
  get niconicoAccount() {
    return transformUrl('https://account.nicovideo.jp');
  }
  get niconicoId() {
    return transformUrl('https://api.id.nicovideo.jp');
  }
  get niconicoOAuth() {
    return transformUrl('https://oauth.nicovideo.jp');
  }
  get nAirLogin() {
    if (process.env.NAIR_LOGIN_URL) {
      return process.env.NAIR_LOGIN_URL;
    }

    const scopes = ['openid', 'profile', 'user.premium'];

    const url = new URL(transformUrl('https://n-air-app.nicovideo.jp/authorize'));
    url.searchParams.set('scope', scopes.join(' '));
    return url.toString();
  }
  get blogNicovideo() {
    return transformUrl('https://blog.nicovideo.jp');
  }
  get niconicoNAirInformationsFeed() {
    return this.replaceHost(
      transformUrl('https://blog.nicovideo.jp/niconews/category/se_n-air/feed/index.xml'),
    );
  }
  get statistics() {
    if (Utils.isDevMode()) {
      return transformUrl('https://n-air-app.dev.nicovideo.jp/statistics');
    } else {
      return transformUrl('https://n-air-app.nicovideo.jp/statistics');
    }
  }

  get nicoLiveWeb() {
    return transformUrl('https://live.nicovideo.jp');
  }

  getWatchPageURL(programID: string): string {
    return `${this.nicoLiveWeb}/watch/${programID}`;
  }
  getMyPageURL(): string {
    return transformUrl('https://garage.nicovideo.jp/niconico-garage/live/history');
  }
  getUserPageURL(userId: string): string {
    return transformUrl(`https://www.nicovideo.jp/user/${userId}`);
  }

  getContentTreeURL(programID: string): string {
    return transformUrl(`https://commons.nicovideo.jp/works/${programID}`);
  }

  getCreatorsProgramURL(programID: string): string {
    return transformUrl(
      `https://commons.nicovideo.jp/cpp-applications/${programID}/new?site_id=nicolive`,
    );
  }

  getModeratorSettingsURL(): string {
    return transformUrl('https://www.upload.nicovideo.jp/niconico-garage/live/moderators');
  }
}
