import * as remote from '@electron/remote';
import Dropdown from 'components/shared/Dropdown.vue';
import { clipboard } from 'electron';
import { $t } from 'services/i18n';
import { SubStreamService, SubStreamTabID } from 'services/substream/SubStreamService';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SubStreamSettings',
  components: {
    Dropdown,
  },
  data() {
    return {
      collapsed: true,
      use: SubStreamService.defaultState.use,
      selectedTab: SubStreamService.defaultState.selectedTab as SubStreamTabID,
      tabSwitching: false,
      serviceIds: ['youtube', 'twitch', 'other'] as SubStreamTabID[],
      url: '',
      key: '',
      videoBitrate: SubStreamService.defaultState.videoBitrate,
      videoCodec: { id: '', name: '' } as { id: string; name: string },
      videoCodecs: [] as { id: string; name: string }[],
      audioBitrate: SubStreamService.defaultState.audioBitrate,
      audioCodec: { id: '', name: '' } as { id: string; name: string },
      audioCodecs: [] as { id: string; name: string }[],
      keyintSec: SubStreamService.defaultState.keyintSec,
      sync: SubStreamService.defaultState.sync,
      status: '',
      initializationError: '',
      commandError: '',
      commandMessage: '',
      commandExecuting: false,
      showKey: false,
      checker: undefined as number | undefined,
      defaultServers: {
        youtube: {
          url: 'rtmp://a.rtmp.youtube.com/live2',
          stream_key_link: 'https://www.youtube.com/live_dashboard',
        },
        twitch: {
          url: 'rtmp://live-tyo.twitch.tv/app',
          stream_key_link: 'https://dashboard.twitch.tv/settings/stream',
        },
      } as { [key: string]: { url: string; stream_key_link: string } },
    };
  },
  computed: {
    serviceOptions(): { id: SubStreamTabID; name: string }[] {
      return (this.serviceIds as SubStreamTabID[]).map((id) => ({ id, name: $t(`settings.substream.tabs.${id}`) }));
    },
  },
  watch: {
    use() {
      SubStreamService.instance().setState({ use: this.use });
      if (!this.use) {
        SubStreamService.instance().stop();
      }
    },
    selectedTab() {
      const tabSettings = SubStreamService.instance().state.tabs[this.selectedTab as SubStreamTabID];
      this.tabSwitching = true;
      this.url = tabSettings.url;
      this.key = tabSettings.key;
      this.$nextTick(() => {
        this.tabSwitching = false;
      });
      SubStreamService.instance().setState({
        selectedTab: this.selectedTab,
        url: tabSettings.url,
        key: tabSettings.key,
      });
    },
    url() {
      if (this.tabSwitching) return;
      this.saveCurrentTabSettings();
    },
    key() {
      if (this.tabSwitching) return;
      this.saveCurrentTabSettings();
    },
    videoBitrate() {
      SubStreamService.instance().setState({ videoBitrate: Number(this.videoBitrate) });
    },
    videoCodec() {
      SubStreamService.instance().setState({ videoCodec: this.videoCodec.id });
    },
    keyintSec() {
      SubStreamService.instance().setState({ keyintSec: Number(this.keyintSec) });
    },
    audioBitrate() {
      SubStreamService.instance().setState({ audioBitrate: Number(this.audioBitrate) });
    },
    audioCodec() {
      SubStreamService.instance().setState({ audioCodec: this.audioCodec.id });
    },
    sync() {
      SubStreamService.instance().setState({ sync: this.sync });
    },
  },
  async mounted() {
    this.use = SubStreamService.instance().state.use;
    this.selectedTab = SubStreamService.instance().state.selectedTab;
    this.url = SubStreamService.instance().state.url;
    this.key = SubStreamService.instance().state.key;
    this.videoBitrate = SubStreamService.instance().state.videoBitrate;
    this.keyintSec = SubStreamService.instance().state.keyintSec;
    this.audioBitrate = SubStreamService.instance().state.audioBitrate;
    this.sync = SubStreamService.instance().state.sync;

    try {
      const r = await SubStreamService.instance().enumEncoderTypes();
      this.videoCodecs = r.encoders.video
        .filter((v) => !/h265|hevc|fallback_amf|qsv11_soft/.test(v.id))
        .map((v) => ({
          id: v.id,
          name: `${v.name}`,
        }));

      this.videoCodec = this.videoCodecs.find(
        (v: { id: string; name: string }) => v.id === SubStreamService.instance().state.videoCodec,
      ) ?? { id: 'obs_x264', name: 'obs_x264' };

      this.audioCodecs = r.encoders.audio.map((v) => ({
        id: v.id,
        name: `${v.name}`,
      }));

      this.audioCodec = this.audioCodecs.find(
        (v: { id: string; name: string }) => v.id === SubStreamService.instance().state.audioCodec,
      ) ?? { id: 'ffmpeg_aac', name: 'ffmpeg_aac' };

      this.startChecker();
    } catch (err) {
      console.error('Failed to initialize substream settings:', err);
      this.initializationError = $t('settings.substream.error.encoder_list_failed');
    }
  },
  beforeUnmount() {
    this.stopChecker();
  },
  methods: {
    saveCurrentTabSettings() {
      const { url, key, selectedTab } = this;
      const tabs = { ...SubStreamService.instance().state.tabs, [selectedTab]: { url, key } };
      SubStreamService.instance().setState({ url, key, tabs });
    },
    setDefaultUrl() {
      if (this.selectedTab === 'other') return;
      this.url = this.defaultServers[this.selectedTab].url;
    },
    toggleShowKey() {
      this.showKey = !this.showKey;
    },
    toggleCollapsed() {
      this.collapsed = !this.collapsed;
    },
    pasteKey() {
      const text = clipboard.readText();
      if (!text || /\s/.test(text)) return;
      this.key = text;
    },
    openExternalLink(url: string) {
      remote.shell.openExternal(url);
    },
    async checkStatus() {
      const r = await SubStreamService.instance().getStatus();

      const statusParts: string[] = [];
      statusParts.push(`${$t('settings.substream.info.status')}: ${r.displayStatus}`);
      if (r.frames) statusParts.push(`${$t('settings.substream.info.frames')}: ${r.frames}`);
      if (r.dropped) statusParts.push(`${$t('settings.substream.info.dropped')}: ${r.dropped}`);

      this.status = statusParts.length > 0 ? statusParts.join('\n') : $t('settings.substream.info.stopped');
    },
    startChecker() {
      this.checkStatus();
      if (this.checker) return;
      this.checker = window.setInterval(() => this.checkStatus(), 1000);
    },
    stopChecker() {
      if (!this.checker) return;
      window.clearInterval(this.checker);
      this.checker = undefined;
    },
    async start() {
      this.commandError = '';
      this.commandMessage = $t('settings.substream.info.processing');
      this.commandExecuting = true;
      try {
        const message = await SubStreamService.instance().start();
        if (message) this.commandError = message;
      } finally {
        this.commandMessage = '';
        this.commandExecuting = false;
      }
    },
    async stop() {
      this.commandError = '';
      this.commandMessage = $t('settings.substream.info.processing');
      this.commandExecuting = true;
      try {
        const message = await SubStreamService.instance().stop();
        if (message) this.commandError = message;
      } finally {
        this.commandMessage = '';
        this.commandExecuting = false;
      }
    },
  },
});
