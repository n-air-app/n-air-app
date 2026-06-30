import { default as Utils, EBit } from 'services/utils';
import { computed, defineComponent, PropType } from 'vue';

import { IObsBitmaskInput, TObsType } from './ObsInput';

const ObsBitMaskInput = defineComponent({
  name: 'ObsBitMaskInput',
  props: {
    value: { type: Object as PropType<IObsBitmaskInput>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  setup(props) {
    const flags = computed(() =>
      Utils.numberToBinnaryArray(props.value.value, props.value.size).reverse(),
    );
    return { flags };
  },
  data() {
    return {
      testingAnchor: `Form/BitMask/${this.value.name}`,
    };
  },
  methods: {
    emitInput(eventData: IObsBitmaskInput) {
      this.$emit('input', eventData);
    },
    onCheckboxChange(event: Event) {
      const el = event.target as HTMLInputElement;
      const index = Number(el.dataset.index);
      this.onChangeHandler(index, el.checked);
    },
    onChangeHandler(index: number, state: boolean) {
      const newFlags = this.flags.slice() as EBit[];
      newFlags[index] = Number(state) as EBit;
      const value = Utils.binnaryArrayToNumber(newFlags.slice().reverse());
      this.emitInput({ ...this.value, value });
    },
  },
});
export default Object.assign(ObsBitMaskInput, { obsType: 'OBS_PROPERTY_BITMASK' as TObsType });
