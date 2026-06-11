import { defineComponent, PropType } from 'vue';

import { propertyComponentForType } from './Components';
import { IObsInput, TObsValue } from './ObsInput';

export default defineComponent({
  name: 'GenericForm',
  emits: {
    input: (_value: IObsInput<TObsValue>[], _index: number) => true,
  },
  props: {
    value: { type: Array as PropType<IObsInput<TObsValue>[]> },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      propertyComponentForType,
    };
  },
  methods: {
    onInputHandler(value: IObsInput<TObsValue>, index: number) {
      const newValue = ([] as IObsInput<TObsValue>[]).concat(this.value);
      newValue.splice(index, 1, value);
      this.$emit('input', newValue, index);
    },
    handlerFor(index: number) {
      return (value: IObsInput<TObsValue>) => this.onInputHandler(value, index);
    },
  },
});
