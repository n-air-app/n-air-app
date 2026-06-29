import { defineComponent, PropType } from 'vue';

import GenericFormItem from './GenericFormItem.vue';
import { IObsInput, TObsValue } from './ObsInput';

export default defineComponent({
  name: 'GenericForm',
  components: { GenericFormItem },
  emits: {
    input: (_value: IObsInput<TObsValue>[], _index: number) => true,
  },
  props: {
    value: { type: Array as PropType<IObsInput<TObsValue>[]>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  methods: {
    onInputHandler(value: IObsInput<TObsValue>, index: number) {
      const newValue = ([] as IObsInput<TObsValue>[]).concat(this.value);
      newValue.splice(index, 1, value);
      this.$emit('input', newValue, index);
    },
  },
});
