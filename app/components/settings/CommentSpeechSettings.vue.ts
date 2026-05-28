import * as remote from '@electron/remote';
import SoundDetectorSettings from 'components/settings/SoundDetectorSettings.vue';
import SpeechEngineSettings from 'components/settings/SpeechEngineSettings.vue';
import DropdownIcon from 'components/shared/DropdownIcon.vue';
import Slider from 'components/shared/Slider.vue';
import TocSection from 'components/shared/TocSection.vue';
import { NicoliveCommentSynthesizerService } from 'services/nicolive-program/nicolive-comment-synthesizer';
import { VoicevoxURL } from 'services/nicolive-program/speech/VoicevoxSynthesizer';
import {
  NicoliveProgramStateService,
  SynthesizerSelector,
  SynthesizerSelectors,
} from 'services/nicolive-program/state';
import { WrappedChat } from 'services/nicolive-program/WrappedChat';
import { defineComponent } from 'vue';

type VoicevoxItem = {
  id: string;
  name: string;
  uuid?: string;
  icon?: string;
};

type SynthesizerItem = {
  id: SynthesizerSelector;
  name: string;
  icon: string;
};

export default defineComponent({
  name: 'CommentSpeechSettings',
  components: {
    DropdownIcon,
    Slider,
    SoundDetectorSettings,
    SpeechEngineSettings,
    TocSection,
  },
  data() {
    return {
      synthesizers: [
        {
          id: 'webSpeech' as SynthesizerSelector,
          name: 'Windowsの音声合成',
          icon: require('../../../media/images/listicon_windows.png'),
        },
        {
          id: 'nVoice' as SynthesizerSelector,
          name: 'N Voice 琴読ニア',
          icon: require('../../../media/images/listicon_nvoice.png'),
        },
        { id: 'voicevox' as SynthesizerSelector, name: 'VOICEVOX', icon: require('../../../media/images/listicon_voicevox.png') },
        {
          id: 'ignore' as SynthesizerSelector,
          name: '読み上げない',
          icon: '',
        },
      ] as SynthesizerItem[],
      voicevoxChecker: undefined as number | undefined,
      isExistVoicevox: false,
      isLoadingVoicevox: true,
      voicevoxItems: [] as VoicevoxItem[],
      voicevoxNormalItem: { id: '', name: '' } as VoicevoxItem,
      voicevoxSystemItem: { id: '', name: '' } as VoicevoxItem,
      voicevoxOperatorItem: { id: '', name: '' } as VoicevoxItem,
      voicevoxIcons: {} as { [id: string]: string },
    };
  },
  computed: {
    synthesizerEnabled: {
      get(): boolean {
        return NicoliveCommentSynthesizerService.instance.enabled;
      },
      set(e: boolean) {
        NicoliveCommentSynthesizerService.instance.enabled = e;
      },
    },
    rate: {
      get(): number {
        return NicoliveCommentSynthesizerService.instance.rate;
      },
      set(v: number) {
        NicoliveCommentSynthesizerService.instance.rate = v;
      },
    },
    rateCandidates(): number[] {
      return [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5, 1.75, 2, 3, 4, 5, 6, 7,
        8, 9, 10,
      ];
    },
    rateDefault(): number {
      return NicoliveCommentSynthesizerService.initialState.rate;
    },
    volume: {
      get(): number {
        return NicoliveCommentSynthesizerService.instance.volume;
      },
      set(v: number) {
        NicoliveCommentSynthesizerService.instance.volume = v;
      },
    },
    volumeCandidates(): number[] {
      return [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    },
    volumeDefault(): number {
      return NicoliveCommentSynthesizerService.initialState.volume;
    },
    synthIds(): readonly SynthesizerSelector[] {
      return SynthesizerSelectors;
    },
    normal: {
      get(): SynthesizerItem {
        return this.getSynthesizerItem(NicoliveCommentSynthesizerService.instance.normal);
      },
      set(s: SynthesizerItem) {
        NicoliveCommentSynthesizerService.instance.normal = s.id;
        this.startVoicevoxChecker();
      },
    },
    operator: {
      get(): SynthesizerItem {
        return this.getSynthesizerItem(NicoliveCommentSynthesizerService.instance.operator);
      },
      set(s: SynthesizerItem) {
        NicoliveCommentSynthesizerService.instance.operator = s.id;
        this.startVoicevoxChecker();
      },
    },
    system: {
      get(): SynthesizerItem {
        return this.getSynthesizerItem(NicoliveCommentSynthesizerService.instance.system);
      },
      set(s: SynthesizerItem) {
        NicoliveCommentSynthesizerService.instance.system = s.id;
        this.startVoicevoxChecker();
      },
    },
    isUseVoicevox(): boolean {
      return (
        NicoliveCommentSynthesizerService.instance.normal === 'voicevox'
        || NicoliveCommentSynthesizerService.instance.operator === 'voicevox'
        || NicoliveCommentSynthesizerService.instance.system === 'voicevox'
      );
    },
    voicevoxInformation: {
      get(): boolean {
        return NicoliveProgramStateService.instance.state.voicevoxInformation;
      },
      set(a: boolean) {
        NicoliveProgramStateService.instance.updateVoicevoxInformation(a);
      },
    },
  },
  watch: {
    voicevoxNormalItem() {
      NicoliveCommentSynthesizerService.instance.voicevoxNormal = this.voicevoxNormalItem;
    },
    voicevoxSystemItem() {
      NicoliveCommentSynthesizerService.instance.voicevoxSystem = this.voicevoxSystemItem;
    },
    voicevoxOperatorItem() {
      NicoliveCommentSynthesizerService.instance.voicevoxOperator = this.voicevoxOperatorItem;
    },
  },
  mounted() {
    this.startVoicevoxChecker();
    if (this.synthesizerEnabled) {
      NicoliveCommentSynthesizerService.instance.prefetchNVoice();
    }
  },
  beforeUnmount() {
    this.stopVoicevoxChecker();
  },
  methods: {
    testSpeechPlay(
      synthId: SynthesizerSelector,
      type: WrappedChat['type'],
      cancelBeforeSpeaking = true,
    ) {
      NicoliveCommentSynthesizerService.instance.testSpeechPlay(synthId, type, cancelBeforeSpeaking);
    },
    resetRate() {
      this.rate = this.rateDefault;
    },
    resetVolume() {
      this.volume = this.volumeDefault;
    },
    resetVoice() {
      this.resetRate();
      this.resetVolume();
    },
    getSynthesizerItem(id: string): SynthesizerItem {
      return this.synthesizers.find((a) => a.id === id) ?? this.synthesizers[0];
    },
    isTestable(id: SynthesizerSelector) {
      if (!NicoliveCommentSynthesizerService.instance.enabled) return false;
      if (id === 'ignore') return false;
      if (id === 'voicevox' && !this.isExistVoicevox) return false;
      return true;
    },
    resetAssignment() {
      this.normal = this.getSynthesizerItem(
        NicoliveCommentSynthesizerService.initialState.selector.normal,
      );
      this.operator = this.getSynthesizerItem(
        NicoliveCommentSynthesizerService.initialState.selector.operator,
      );
      this.system = this.getSynthesizerItem(
        NicoliveCommentSynthesizerService.initialState.selector.system,
      );
      this.voicevoxInformation = true;
    },
    async readVoicevoxList() {
      if (this.isExistVoicevox) return;

      try {
        const list: VoicevoxItem[] = [];
        const json = (await (await fetch(`${VoicevoxURL}/speakers`)).json()) as {
          name: string;
          speaker_uuid: string;
          styles: { id: string; name: string; type: string }[];
        }[];
        this.isExistVoicevox = true;

        for (const item of json) {
          const name = item['name'];
          const uuid = item['speaker_uuid'];
          for (const style of item['styles']) {
            const id = style['id'];
            const sn = style['name'];
            if (id === undefined || sn === undefined || style['type'] !== 'talk') continue;
            const icon = await this.getVoicevoxIcon(id, uuid);
            list.push({ id, uuid, name: `${name} ${sn}`, icon });
          }
        }
        if (!list.length) return;
        this.voicevoxItems = list;
        this.voicevoxNormalItem = this.getVoicevoxItem(
          NicoliveCommentSynthesizerService.instance.voicevoxNormal.id,
        );
        this.voicevoxSystemItem = this.getVoicevoxItem(
          NicoliveCommentSynthesizerService.instance.voicevoxSystem.id,
        );
        this.voicevoxOperatorItem = this.getVoicevoxItem(
          NicoliveCommentSynthesizerService.instance.voicevoxOperator.id,
        );

        this.isLoadingVoicevox = false;
      } catch (e) {
        this.isExistVoicevox = false;
        this.isLoadingVoicevox = false;
      }
    },
    getVoicevoxItem(id: string): VoicevoxItem {
      return this.voicevoxItems.find((a) => a.id === id) ?? { id: '', name: '' };
    },
    async getVoicevoxIcon(id: string, uuid?: string) {
      if (this.voicevoxIcons[id]) return this.voicevoxIcons[id];

      if (!uuid) {
        const item = this.getVoicevoxItem(id);
        if (!item || !item.uuid) return '';
        uuid = item.uuid;
      }
      try {
        const json = (await (
          await fetch(`${VoicevoxURL}/speaker_info?resource_format=url&speaker_uuid=${uuid}`)
        ).json()) as { style_infos: { id: string; icon: string }[] };

        for (const info of json.style_infos) {
          const id = info['id'];
          const icon = info['icon'];
          if (id === undefined || !icon) continue;
          this.voicevoxIcons[id] = icon;
        }
      } catch (e) {
        // 想定外の形式の場合における例外排除
      }

      return this.voicevoxIcons[id] ?? '';
    },
    startVoicevoxChecker() {
      if (!this.isUseVoicevox) {
        this.stopVoicevoxChecker();
        return;
      }
      if (this.isExistVoicevox) return;
      this.readVoicevoxList();
      if (this.voicevoxChecker !== undefined) return;
      this.voicevoxChecker = window.setInterval(() => this.readVoicevoxList(), 3000);
    },
    stopVoicevoxChecker() {
      if (this.voicevoxChecker === undefined) return;
      window.clearInterval(this.voicevoxChecker);
      this.voicevoxChecker = undefined;
    },
    closeVoicevoxInformation() {
      this.voicevoxInformation = false;
    },
    showVoicevoxInformation() {
      remote.shell.openExternal('https://qa.nicovideo.jp/faq/show/23961?site_domain=default');
    },
  },
});
