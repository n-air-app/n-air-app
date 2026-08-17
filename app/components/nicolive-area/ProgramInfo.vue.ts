import * as remote from '@electron/remote';
import Popper from 'components/shared/Popper.vue';
import { clipboard } from 'electron';
import { DateTime } from 'luxon';
import { Subscription } from 'rxjs';
import { HostsService } from 'services/hosts';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ProgramInfo',

  components: { Popper },

  data() {
    return {
      subscription: null as Subscription | null,
      showPopupMenu: false,
    };
  },

  mounted() {
    this.subscription = NicoliveProgramService.instance().stateChange.subscribe((state) => {
      if (state.status === 'end') {
        if (StreamingService.instance().isStreaming) {
          StreamingService.instance().toggleStreamingAsync();
        }
      }
    });
  },

  unmounted() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  },

  computed: {
    isOnAir(): boolean {
      return NicoliveProgramService.instance().state.status === 'onAir';
    },

    programID(): string {
      return NicoliveProgramService.instance().state.programID;
    },

    programStatus(): string {
      return NicoliveProgramService.instance().state.status;
    },

    programTitle(): string {
      return NicoliveProgramService.instance().state.title;
    },

    userName(): string {
      return UserService.instance().username ?? '';
    },

    userIcon(): string {
      return UserService.instance().userIcon ?? '';
    },

    autoExtensionEnabled() {
      return NicoliveProgramService.instance().state.autoExtensionEnabled;
    },

    watchPageURL(): string {
      return HostsService.instance().getWatchPageURL(this.programID);
    },

    contentTreeURL(): string {
      return HostsService.instance().getContentTreeURL(this.programID);
    },

    creatorsProgramURL(): string {
      return HostsService.instance().getCreatorsProgramURL(this.programID);
    },

    xShareURL(): string {
      const content = this.xShareContent();
      const url = new URL('https://x.com/intent/tweet');
      url.searchParams.append('text', content.text);
      url.searchParams.append('url', content.url);
      return url.toString();
    },

    isFetching(): boolean {
      return NicoliveProgramService.instance().state.isFetching;
    },

    existsProgramPassword(): boolean {
      return !!NicoliveProgramService.instance().state.password;
    },
  },

  methods: {
    toggleAutoExtension() {
      NicoliveProgramService.instance().toggleAutoExtension();
    },

    openInDefaultBrowser(event: MouseEvent): void {
      const href = (event.currentTarget as HTMLAnchorElement).href;
      const url = new URL(href);
      if (/^https?/.test(url.protocol)) {
        remote.shell.openExternal(url.toString());
      }
    },

    async editProgram() {
      try {
        return await NicoliveProgramService.instance().editProgram();
      } catch (e) {
        // TODO 失敗時にはユーザーに伝えるべき
        console.warn(e);
      }
    },

    xShareContent(): { text: string; url: string } {
      const title = NicoliveProgramService.instance().state.title;
      const url = `${HostsService.instance().getWatchPageURL(this.programID)}?ref=sharetw`;
      const time = NicoliveProgramService.instance().state.startTime;
      const formattedTime = DateTime.fromSeconds(time).toFormat('yyyy/MM/dd HH:mm');

      if (this.programStatus === 'reserved' || this.programStatus === 'test') {
        return {
          text: `【ニコ生(${formattedTime}開始)】${title}`,
          url,
        };
      }

      if (this.programStatus === 'onAir') {
        return {
          text: `【ニコ生配信中】${title}`,
          url,
        };
      }

      if (this.programStatus === 'end') {
        return {
          text: `【ニコ生タイムシフト視聴中(${formattedTime}放送)】${title}`,
          url,
        };
      }

      return { text: title, url };
    },

    copyProgramURL() {
      if (this.isFetching) throw new Error('fetchProgram is running');
      clipboard.writeText(
        HostsService.instance().getWatchPageURL(NicoliveProgramService.instance().state.programID),
      );
    },

    copyProgramPassword() {
      if (this.isFetching) throw new Error('fetchProgram is running');
      clipboard.writeText(NicoliveProgramService.instance().state.password ?? '');
    },
  },
});

