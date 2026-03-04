import * as remote from '@electron/remote';
import { NicoliveClient } from 'services/nicolive-program/NicoliveClient';
import { Component, Prop } from 'vue-property-decorator';
import { CommentBase } from './CommentBase';
import { SpeakingType } from './SpeakingType';

@Component({})
export default class CommonComment extends CommentBase {
  @Prop({ default: false }) commentMenuOpened: boolean;
  @Prop() speaking: SpeakingType;
  @Prop() nameplateHint: boolean;

  moderatorTooltip = 'モデレーター';
  supporterTooltip = 'サポーター';
  get speakingTooltip() {
    return this.isSpeaking ? '読み上げ中' : '一時停止中';
  }

  get isSpeaking(): boolean {
    return this.speaking === SpeakingType.SPEAKING;
  }

  get isBlocking(): boolean {
    return this.speaking === SpeakingType.BLOCKING;
  }

  get showSpeakingIcon(): boolean {
    return this.speaking !== SpeakingType.NONE;
  }

  userIconURL: string = NicoliveClient.getUserIconURL(
    this.chat.value.user_id,
    `${this.chat.value.thread}`,
  );

  defaultUserIconURL = NicoliveClient.defaultUserIconURL;

  openInDefaultBrowser(event: MouseEvent): void {
    const href = (event.currentTarget as HTMLAnchorElement).href;
    const url = new URL(href);
    if (/^https?/.test(url.protocol)) {
      remote.shell.openExternal(url.toString());
    }
  }
}
