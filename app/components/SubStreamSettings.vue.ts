import * as remote from '@electron/remote';
import { clipboard } from 'electron';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { SubStreamService, SubStreamTabID } from 'services/substream/SubStreamService';
import Vue from 'vue';
import Multiselect from 'vue-multiselect';
import { Component, Watch } from 'vue-property-decorator';

@Component({
  components: {
    Multiselect,
  },
})
export default class SubStreamSettings extends Vue {
  @Inject() subStreamService: SubStreamService;

  collapsed: boolean = true;

  use: boolean = SubStreamService.defaultState.use;
  selectedTab: SubStreamTabID = SubStreamService.defaultState.selectedTab;
  readonly tabIds: SubStreamTabID[] = ['youtube', 'twitch', 'other'];
  url: string = '';
  key: string = '';

  videoBitrate: number = SubStreamService.defaultState.videoBitrate;
  videoCodec: { id: string; name: string } = { id: '', name: '' };
  videoCodecs: { id: string; name: string }[] = [];

  audioBitrate: number = SubStreamService.defaultState.audioBitrate;
  audioCodec: { id: string; name: string } = { id: '', name: '' };
  audioCodecs: { id: string; name: string }[] = [];

  keyintSec: number = SubStreamService.defaultState.keyintSec;
  sync: boolean = SubStreamService.defaultState.sync;

  status: string = '';
  showKey: boolean = false;

  checker?: number = undefined;

  defautServers: { [key: string]: { url: string; stream_key_link: string } } = {
    youtube: {
      url: 'rtmp://a.rtmp.youtube.com/live2',
      stream_key_link: 'https://www.youtube.com/live_dashboard',
    },
    twitch: {
      url: 'rtmp://live-tyo.twitch.tv/app',
      stream_key_link: 'https://dashboard.twitch.tv/settings/stream',
    },
  };

  /** 現在のタブのタブ設定をストアに書き戻す */
  private saveCurrentTabSettings() {
    const tabs = { ...this.subStreamService.state.tabs };
    tabs[this.selectedTab] = { url: this.url, key: this.key };
    this.subStreamService.setState({ tabs });
  }

  @Watch('use')
  onUseChange() {
    this.subStreamService.setState({ use: this.use });
    if (!this.use) {
      this.subStreamService.stop();
    }
  }

  selectTab(tab: SubStreamTabID) {
    this.selectedTab = tab;
  }

  setDefaultUrl() {
    this.url = this.defautServers[this.selectedTab].url;
  }

  toggleShowKey() {
    this.showKey = !this.showKey;
  }

  toggleCollapsed() {
    this.collapsed = !this.collapsed;
  }

  @Watch('selectedTab')
  onSelectedTabChange() {
    this.subStreamService.setState({ selectedTab: this.selectedTab });
    // 新しいタブのURL/keyをローカル変数に反映
    const tabSettings = this.subStreamService.state.tabs[this.selectedTab];
    // URL が空の場合は YouTube/Twitch のデフォルト値を自動セット
    if (!tabSettings.url && this.selectedTab !== 'other') {
      this.url = this.defautServers[this.selectedTab].url;
    } else {
      this.url = tabSettings.url;
    }
    this.key = tabSettings.key;
  }

  @Watch('url')
  onUrlChange() {
    this.saveCurrentTabSettings();
  }

  @Watch('key')
  onKeyChange() {
    this.saveCurrentTabSettings();
  }

  @Watch('videoBitrate')
  onVideoBitrateChange() {
    this.subStreamService.setState({ videoBitrate: Number(this.videoBitrate) });
  }

  @Watch('videoCodec')
  onVideoCodecChange() {
    this.subStreamService.setState({ videoCodec: this.videoCodec.id });
  }

  @Watch('keyintSec')
  onKeyintSecChange() {
    this.subStreamService.setState({ keyintSec: Number(this.keyintSec) });
  }

  @Watch('audioBitrate')
  onAudioBitrateChange() {
    this.subStreamService.setState({ audioBitrate: Number(this.audioBitrate) });
  }

  @Watch('audioCodec')
  onAudioCodecChange() {
    this.subStreamService.setState({ audioCodec: this.audioCodec.id });
  }

  @Watch('sync')
  onSyncChange() {
    this.subStreamService.setState({ sync: this.sync });
  }

  pasteKey() {
    const text = clipboard.readText();
    if (!text || /\s/.test(text)) return;
    this.key = text;
  }

  async mounted() {
    this.use = this.subStreamService.state.use;
    this.selectedTab = this.subStreamService.state.selectedTab;
    const tabSettings = this.subStreamService.state.tabs[this.selectedTab];
    // URL が空で YouTube/Twitch タブならデフォルト値をセット
    if (!tabSettings.url && this.selectedTab !== 'other') {
      this.url = this.defautServers[this.selectedTab].url;
      // ストアにも保存
      const tabs = { ...this.subStreamService.state.tabs };
      tabs[this.selectedTab] = { url: this.url, key: tabSettings.key };
      this.subStreamService.setState({ tabs });
    } else {
      this.url = tabSettings.url;
    }
    this.key = tabSettings.key;
    this.videoBitrate = this.subStreamService.state.videoBitrate;
    this.keyintSec = this.subStreamService.state.keyintSec;
    this.audioBitrate = this.subStreamService.state.audioBitrate;
    this.sync = this.subStreamService.state.sync;

    const r = await this.subStreamService.enumEncoderTypes();
    if (r.encoders) {
      this.videoCodecs = r.encoders.video
        .filter(v => !/h265|hevc|fallback_amf|qsv11_soft/.test(v.id))
        .map(v => ({
          id: v.id,
          name: `${v.name}`,
        }));

      this.videoCodec = this.videoCodecs.find(
        v => v.id === this.subStreamService.state.videoCodec,
      ) ?? { id: 'obs_x264', name: 'obs_x264' };

      this.audioCodecs = r.encoders.audio.map(v => ({
        id: v.id,
        name: `${v.name}`,
      }));

      this.audioCodec = this.audioCodecs.find(
        v => v.id === this.subStreamService.state.audioCodec,
      ) ?? { id: 'ffmpeg_aac', name: 'ffmpeg_aac' };

      this.startChecker();
    }
  }

  beforeDestroy() {
    this.stopChecker();
  }

  openExternalLink(url: string) {
    remote.shell.openExternal(url);
  }

  async checkStatus() {
    const r = await this.subStreamService.getStatus();

    const statusParts: string[] = [];
    statusParts.push(`${$t('settings.substream.info.status')}: ${r.displayStatus}`);
    if (r.frames) statusParts.push(`${$t('settings.substream.info.frames')}: ${r.frames}`);
    if (r.dropped) statusParts.push(`${$t('settings.substream.info.dropped')}: ${r.dropped}`);

    this.status =
      statusParts.length > 0 ? statusParts.join('\n') : $t('settings.substream.info.stopped');
  }

  startChecker() {
    this.checkStatus();
    if (this.checker) return;
    this.checker = window.setInterval(() => this.checkStatus(), 1000);
  }

  stopChecker() {
    if (!this.checker) return;
    window.clearInterval(this.checker);
    this.checker = undefined;
  }

  async start() {
    const message = await this.subStreamService.start();
    if (message) {
      remote.dialog.showErrorBox('Error', message);
    }
  }

  async stop() {
    await this.subStreamService.stop();
  }
}
