import { propertyComponentForType } from 'components/obs/inputs/Components';
import { TObsValue } from 'components/obs/inputs/ObsInput';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { IAudioServiceApi, IAudioSourceApi } from 'services/audio';
import { Inject } from 'services/core/injector';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: { ModalLayout },
})
export default class AdvancedAudio extends Vue {
  @Inject() audioService: IAudioServiceApi;

  propertyComponentForType = propertyComponentForType;

  get audioSources() {
    return this.audioService.getSourcesForCurrentScene();
  }

  getRow1Controls(audioSource: IAudioSourceApi) {
    const form = audioSource.getSettingsForm();
    return ['monitoringType', 'deflection'].flatMap(name => form.filter(f => f.name === name));
  }

  getRow2Controls(audioSource: IAudioSourceApi) {
    const form = audioSource.getSettingsForm();
    return ['syncOffset', 'forceMono'].flatMap(name => form.filter(f => f.name === name));
  }

  getRow3Controls(audioSource: IAudioSourceApi) {
    return audioSource.getSettingsForm().filter(f => f.name === 'audioMixers');
  }

  onInputHandler(audioSource: IAudioSourceApi, name: string, value: TObsValue) {
    if (name === 'deflection') {
      audioSource.setDeflection((value as number) / 100);
    } else {
      audioSource.setSettings({ [name]: value });
    }
  }
}
