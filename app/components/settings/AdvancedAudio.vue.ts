import { propertyComponentForType } from 'components/obs/inputs/Components';
import { TObsValue } from 'components/obs/inputs/ObsInput';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { AudioService, IAudioSourceApi } from 'services/audio';
import { SettingsService } from 'services/settings';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'AdvancedAudio',
  components: { ModalLayout },
  data() {
    return {
      propertyComponentForType,
    };
  },
  computed: {
    audioSources() {
      return AudioService.instance().getSourcesForCurrentScene();
    },
    isAdvancedOutput(): boolean {
      return SettingsService.instance().state.Output?.Mode === 'Advanced';
    },
    // 配信出力が使う音声トラック(1始まり)。基本モードはトラック1固定、詳細モードは TrackIndex で選ぶ
    streamingTrack(): number {
      if (!this.isAdvancedOutput) return 1;
      return Number(SettingsService.instance().state.Output.TrackIndex) || 1;
    },
  },
  methods: {
    sourceName(audioSource: IAudioSourceApi): string {
      return audioSource.getModel().name;
    },
    onInputHandler(audioSource: IAudioSourceApi, name: string, value: TObsValue) {
      if (name === 'deflection') {
        audioSource.setDeflection((value as number) / 100);
      } else {
        audioSource.setSettings({ [name]: value });
      }
    },
  },
});
