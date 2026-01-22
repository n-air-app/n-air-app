import { debounce } from 'lodash';
import { Component, Prop } from 'vue-property-decorator';
import Slider from '../../shared/Slider.vue';
import { IObsSliderInputValue, ObsInput, TObsType } from './ObsInput';

@Component({
  components: { Slider },
})
class ObsSliderInput extends ObsInput<IObsSliderInputValue> {
  static obsType: TObsType;

  @Prop() value: IObsSliderInputValue;
  testingAnchor = `Form/Slider/${this.value.name}`;

  // Local value is an instaneous value that is updated as the user
  // moves the slider.  It makes the UI feel more responsive.
  localValue = this.value.value;

  private emitValueImpl(value: number) {
    this.emitInput({ ...this.value, value });
  }

  private debouncedEmitValue = debounce(this.emitValueImpl, 100);

  updateValue(value: number) {
    this.localValue = value;
    this.emitValue(value);
  }

  emitValue(value: number) {
    this.debouncedEmitValue(value);
  }

  beforeDestroy() {
    this.debouncedEmitValue.cancel();
  }
}

ObsSliderInput.obsType = 'OBS_PROPERTY_SLIDER';

export default ObsSliderInput;
