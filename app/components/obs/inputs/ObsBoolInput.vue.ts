import { defineComponent, PropType } from 'vue';

import { IObsInput, TObsType } from './ObsInput';

const ObsBoolInput = defineComponent({
  name: 'ObsBoolInput',
  emits: ['input'],
  props: {
    value: { type: Object as PropType<IObsInput<boolean>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Bool/${this.value.name}`,
    };
  },
  methods: {
    emitInput(eventData: IObsInput<boolean>) {
      this.$emit('input', eventData);
    },
    handleClick() {
      if (this.value.enabled === false) return;
      this.emitInput({ ...this.value, value: !this.value.value });
    },
  },
});
export default Object.assign(ObsBoolInput, { obsType: 'OBS_PROPERTY_BOOL' as TObsType });
