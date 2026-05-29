import Dropdown from 'components/shared/Dropdown.vue';
import { defineComponent, PropType } from 'vue';

import { IObsListInput, IObsListOption, TObsType, TObsValue } from './ObsInput';

const ObsListInput = defineComponent({
  name: 'ObsListInput',
  components: { Dropdown },
  props: {
    value: { type: Object as PropType<IObsListInput<TObsValue>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
    allowEmpty: { type: Boolean, default: false },
    placeholder: { type: String },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      testingAnchor: `Form/List/${this.value.name}`,
    };
  },
  computed: {
    currentValue(): IObsListOption<TObsValue> | string {
      const option = this.value.options.find((opt: IObsListOption<TObsValue>) => this.value.value === opt.value);
      if (option) return option;
      if (this.allowEmpty) return '';
      return this.value.options[0];
    },
  },
  methods: {
    emitInput(eventData: IObsListInput<TObsValue>) {
      this.$emit('input', eventData);
    },
    onInputHandler(option: IObsListOption<string>) {
      this.emitInput({ ...this.value, value: option ? option.value : null });
    },
  },
});
export default Object.assign(ObsListInput, { obsType: 'OBS_PROPERTY_LIST' as TObsType });
