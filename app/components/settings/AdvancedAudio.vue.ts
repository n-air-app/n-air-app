import { propertyComponentForType } from 'components/obs/inputs/Components';
import { TObsValue } from 'components/obs/inputs/ObsInput';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { AudioService, IAudioSourceApi } from 'services/audio';
import { defineComponent, onUnmounted, ref } from 'vue';

export default defineComponent({
  name: 'AdvancedAudio',
  components: { ModalLayout },
  setup() {
    const audioSources = ref(AudioService.instance().getSourcesForCurrentScene());

    const subscription = AudioService.instance().audioSourceUpdated.subscribe(() => {
      audioSources.value = AudioService.instance().getSourcesForCurrentScene();
    });
    onUnmounted(() => subscription.unsubscribe());

    return { audioSources, propertyComponentForType };
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
