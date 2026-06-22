import { default as Utils, EBit } from 'services/utils';
import { defineComponent, PropType } from 'vue';

import { IObsBitmaskInput, TObsType } from './ObsInput';

const ObsBitMaskInput = defineComponent({
  name: 'ObsBitMaskInput',
  props: {
    value: { type: Object as PropType<IObsBitmaskInput>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/BitMask/${this.value.name}`,
      flags: [] as EBit[],
    };
  },
  watch: {
    value() {
      this.updateFlags();
    },
  },
  mounted() {
    this.updateFlags();
  },
  methods: {
    emitInput(eventData: IObsBitmaskInput) {
      this.$emit('input', eventData);
    },
    updateFlags() {
      this.flags = Utils.numberToBinnaryArray(this.value.value, this.value.size).reverse();
    },
    onCheckboxChange(event: Event) {
      const el = event.target as HTMLInputElement;
      const index = Number(el.dataset.index);
      this.onChangeHandler(index, el.checked);
    },
    onChangeHandler(index: number, state: boolean) {
      this.flags[index] = Number(state);
      const value = Utils.binnaryArrayToNumber(this.flags.reverse());
      this.emitInput({ ...this.value, value });
    },
  },
});
export default Object.assign(ObsBitMaskInput, { obsType: 'OBS_PROPERTY_BITMASK' as TObsType });
