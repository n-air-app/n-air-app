import Dropdown from 'components/shared/Dropdown.vue';
import { Component, Prop } from 'vue-property-decorator';
import { IObsListInput, IObsListOption, ObsInput, TObsType, TObsValue } from './ObsInput';

@Component({
  components: { Dropdown },
})
class ObsResolutionInput extends ObsInput<IObsListInput<TObsValue>> {
  static obsType: TObsType;

  @Prop()
  value: IObsListInput<TObsValue>;
  testingAnchor = `Form/Resolution/${this.value.name}`;

  onInputHandler(option: IObsListOption<string>) {
    this.emitInput({ ...this.value, value: option.value });
  }

  get currentValue() {
    let option = this.value.options.find(opt => {
      return this.value.value === opt.value;
    });

    if (option) return option;

    if (this.value.value) {
      option = { value: this.value.value, description: this.value.value } as IObsListOption<string>;
      this.value.options.push(option);
      return option;
    }

    return this.value.options[0];
  }
}

ObsResolutionInput.obsType = 'OBS_INPUT_RESOLUTION_LIST';

export default ObsResolutionInput;
