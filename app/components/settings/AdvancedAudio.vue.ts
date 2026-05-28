import { propertyComponentForType } from 'components/obs/inputs/Components';
import { TObsValue } from 'components/obs/inputs/ObsInput';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { AudioService, IAudioSourceApi } from 'services/audio';
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
      return AudioService.instance.getSourcesForCurrentScene();
    },
  },
  methods: {
    onInputHandler(audioSource: IAudioSourceApi, name: string, value: TObsValue) {
      if (name === 'deflection') {
        audioSource.setDeflection((value as number) / 100);
      } else {
        audioSource.setSettings({ [name]: value });
      }
    },
  },
});
