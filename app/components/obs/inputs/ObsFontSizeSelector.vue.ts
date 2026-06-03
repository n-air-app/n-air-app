import Dropdown from 'components/shared/Dropdown.vue';
import { Component, Prop } from 'vue-property-decorator';

import { ObsInput } from './ObsInput';

@Component({ components: { Dropdown } })
export default class ObsFontSizeSelector extends ObsInput<number> {
  @Prop()
    value: number;
  testingAnchor = 'Form/FontSize';

  setFontSizePreset(size: number) {
    this.emitInput(size);
  }

  get fontSizePresets() {
    return [9, 10, 11, 12, 13, 14, 18, 24, 36, 48, 64, 72, 96, 144, 288];
  }
}
