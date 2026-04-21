import { propertyComponentForType } from 'components/obs/inputs/Components';
import { TObsValue } from 'components/obs/inputs/ObsInput';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { IAudioServiceApi, IAudioSourceApi } from 'services/audio';
import { Inject } from 'services/core/injector';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

const PRIMARY_CONTROLS = ['deflection', 'monitoringType'];

@Component({
  components: { ModalLayout },
})
export default class AdvancedAudio extends Vue {
  @Inject() audioService: IAudioServiceApi;

  propertyComponentForType = propertyComponentForType;

  expandedSources: Record<string, boolean> = {};

  get audioSources() {
    return this.audioService.getSourcesForCurrentScene();
  }

  getPrimaryControls(audioSource: IAudioSourceApi) {
    return audioSource.getSettingsForm().filter(f => PRIMARY_CONTROLS.includes(f.name));
  }

  getDetailControls(audioSource: IAudioSourceApi) {
    return audioSource.getSettingsForm().filter(f => !PRIMARY_CONTROLS.includes(f.name));
  }

  isExpanded(sourceId: string) {
    return !!this.expandedSources[sourceId];
  }

  toggleExpand(sourceId: string) {
    this.$set(this.expandedSources, sourceId, !this.expandedSources[sourceId]);
  }

  onInputHandler(audioSource: IAudioSourceApi, name: string, value: TObsValue) {
    if (name === 'deflection') {
      audioSource.setDeflection((value as number) / 100);
    } else {
      audioSource.setSettings({ [name]: value });
    }
  }
}
