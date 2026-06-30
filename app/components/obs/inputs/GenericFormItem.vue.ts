import { defineComponent, PropType } from 'vue';

import { propertyComponentForType } from './Components';
import { IObsInput, TObsValue } from './ObsInput';

export default defineComponent({
  name: 'GenericFormItem',
  emits: {
    input: (_value: IObsInput<TObsValue>, _index: number) => true,
  },
  props: {
    parameter: { type: Object as PropType<IObsInput<TObsValue>>, required: true as const },
    index: { type: Number, required: true as const },
    value: { type: Object as PropType<IObsInput<TObsValue>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      propertyComponentForType,
    };
  },
  methods: {
    onInput(value: IObsInput<TObsValue>) {
      this.$emit('input', value, this.index);
    },
  },
});
