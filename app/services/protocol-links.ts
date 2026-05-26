import { URL, URLSearchParams } from 'url';

import * as Sentry from '@sentry/electron/renderer';
import electron from 'electron';
import { Inject } from 'services/core/injector';
import { Service } from 'services/core/service';
import { NavigationService } from 'services/navigation';

import { SettingsCategory, SettingsService } from './settings';
import Utils from './utils';

/**
 * Describes a protocol link that was clicked
 */
interface IProtocolLinkInfo {
  base: string;
  path: string;
  hash: string;
  query: URLSearchParams;
}

export class ProtocolLinksService extends Service {
  @Inject() navigationService: NavigationService;
  @Inject() settingsService: SettingsService;

  // Maps base URL components to handler function names
  private handlers: Dictionary<string> = {
    settings: 'openSettings',
  };

  start(argv: string[]) {
    // Check if this instance was started with a protocol link
    argv.forEach((arg) => {
      if (arg.match(/^n-air-app:\/\//)) this.handleLink(arg);
    });

    // Other instances started with a protocol link will receive this message
    electron.ipcRenderer.on('protocolLink', (event: Electron.Event, link: string) =>
      this.handleLink(link),
    );
  }

  private handleLink(link: string) {
    const parsed = new URL(link);
    const info: IProtocolLinkInfo = {
      base: parsed.host,
      path: parsed.pathname,
      hash: parsed.hash,
      query: parsed.searchParams,
    };

    if (Utils.isDevMode()) {
      console.log('Handling protocol link', info);
    }
    Sentry.addBreadcrumb({
      category: 'protocol-link',
      message: 'Handling protocol link',
      data: info,
    });

    if (this.handlers[info.base]) {
      // @ts-expect-error ts7053
      this[this.handlers[info.base]](info);
    }
  }

  private openSettings(info: IProtocolLinkInfo) {
    type CategoryRedirect = { category: SettingsCategory; defaultHash?: string };
    const RENAMED_CATEGORIES: Record<string, CategoryRedirect> = {
      SpeechEngine: { category: 'CommentSpeech', defaultHash: '#speech-engine-settings' },
    };
    const rawCategory = info.path.replace('/', '');
    const redirect = RENAMED_CATEGORIES[rawCategory];
    const category = (redirect?.category ?? rawCategory) as SettingsCategory;
    const hash = info.hash || redirect?.defaultHash || undefined;

    this.settingsService.showSettings(category, hash);
  }
}
