import Slider from 'components/shared/Slider.vue';
import MixerVolmeter from 'components/studio/MixerVolmeter.vue';
import { AudioSource } from 'services/audio';
import { CompactModeService } from 'services/compact-mode';
import { Inject } from 'services/core/injector';
import { CustomizationService } from 'services/customization';
import { EditMenu } from 'util/menus/EditMenu';
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';

@Component({
  components: { Slider, MixerVolmeter },
})
export default class MixerItem extends Vue {
  @Prop() audioSource: AudioSource;

  @Inject() compactModeService: CompactModeService;
  @Inject() private customizationService: CustomizationService;

  get previewEnabled() {
    return !this.customizationService.state.performanceMode;
  }

  get isCompactMode(): boolean {
    return this.compactModeService.isCompactMode;
  }

  setMuted(muted: boolean) {
    this.audioSource.setMuted(muted);
  }

  onSliderChangeHandler(newVal: number) {
    this.audioSource.setDeflection(newVal);
  }

  showSourceMenu(sourceId: string) {
    const menu = new EditMenu({
      selectedSourceId: sourceId,
      showAudioMixerMenu: true,
    });
    menu.popup();
  }
}
