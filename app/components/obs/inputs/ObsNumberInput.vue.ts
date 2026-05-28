import { defineComponent, PropType } from 'vue';

import { IObsInput, TObsType } from './ObsInput';

const ObsNumberInput = defineComponent({
  name: 'ObsNumberInput',
  props: {
    value: { type: Object as PropType<IObsInput<number>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Number/${this.value.name}`,
    };
  },
  methods: {
    emitInput(eventData: IObsInput<number>) {
      this.$emit('input', eventData);
    },
    updateValue(value: string) {
      let formattedValue = value;
      if (isNaN(Number(formattedValue))) formattedValue = '0';
      const input = this.$refs.input as HTMLInputElement;
      if (formattedValue !== value) {
        input.value = formattedValue;
      }
      this.emitInput({ ...this.value, value: Number(formattedValue) });
    },
  },
});
export default Object.assign(ObsNumberInput, { obsType: ['OBS_PROPERTY_DOUBLE', 'OBS_PROPERTY_FLOAT'] as TObsType[] });
