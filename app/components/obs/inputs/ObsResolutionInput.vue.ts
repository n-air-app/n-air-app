import Dropdown from 'components/shared/Dropdown.vue';
import { defineComponent, PropType } from 'vue';

import { IObsListInput, IObsListOption, TObsType, TObsValue } from './ObsInput';

const ObsResolutionInput = defineComponent({
  name: 'ObsResolutionInput',
  emits: ['input'],
  components: { Dropdown },
  props: {
    value: { type: Object as PropType<IObsListInput<TObsValue>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Resolution/${this.value.name}`,
    };
  },
  computed: {
    currentValue(): IObsListOption<TObsValue> {
      const option = this.value.options.find((opt: IObsListOption<TObsValue>) => this.value.value === opt.value);
      if (option) return option;
      if (this.value.value) {
        return { value: this.value.value, description: this.value.value as string } as IObsListOption<string>;
      }
      return this.value.options[0];
    },
  },
  methods: {
    emitInput(eventData: IObsListInput<TObsValue>) {
      this.$emit('input', eventData);
    },
    onInputHandler(option: IObsListOption<string>) {
      this.emitInput({ ...this.value, value: option.value });
    },
  },
});
export default Object.assign(ObsResolutionInput, { obsType: 'OBS_INPUT_RESOLUTION_LIST' as TObsType });
