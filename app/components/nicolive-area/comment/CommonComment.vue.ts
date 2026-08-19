import * as remote from '@electron/remote';
import { NicoliveClient } from 'services/nicolive-program/NicoliveClient';
import { defineComponent, PropType } from 'vue';

import { CommentBase } from './CommentBase';
import { SpeakingType } from './SpeakingType';

export default defineComponent({
  name: 'CommonComment',
  mixins: [CommentBase],
  props: {
    commentMenuOpened: { type: Boolean, default: false },
    speaking: { type: Number as PropType<SpeakingType> },
    nameplateHint: { type: Boolean },
  },
  data() {
    return {
      moderatorTooltip: 'モデレーター',
      supporterTooltip: 'サポーター',
      userIconURL: NicoliveClient.getUserIconURL(
        this.chat.value.user_id ?? '',
        `${this.chat.value.thread ?? ''}`,
      ),
      defaultUserIconURL: NicoliveClient.defaultUserIconURL,
    };
  },
  computed: {
    speakingTooltip(): string {
      return this.isSpeaking ? '読み上げ中' : '一時停止中';
    },
    isSpeaking(): boolean {
      return this.speaking === SpeakingType.SPEAKING;
    },
    isBlocking(): boolean {
      return this.speaking === SpeakingType.BLOCKING;
    },
    showSpeakingIcon(): boolean {
      return this.speaking !== SpeakingType.NONE;
    },
  },
  methods: {
    openInDefaultBrowser(event: MouseEvent): void {
      const href = (event.currentTarget as HTMLAnchorElement).href;
      const url = new URL(href);
      if (/^https?/.test(url.protocol)) {
        remote.shell.openExternal(url.toString());
      }
    },
  },
});
