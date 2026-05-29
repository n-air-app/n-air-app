import Slider from 'components/shared/Slider.vue';
import { DebouncedFunc } from 'lodash';
import debounce from 'lodash/debounce';
import { defineComponent, PropType } from 'vue';

import { IObsSliderInputValue, TObsType } from './ObsInput';

const ObsSliderInput = defineComponent({
  name: 'ObsSliderInput',
  components: { Slider },
  props: {
    value: { type: Object as PropType<IObsSliderInputValue>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Slider/${this.value.name}`,
      localValue: this.value.value as number,
      debouncedEmitValue: null as DebouncedFunc<(value: number) => void> | null,
    };
  },
  watch: {
    'value.value': function(newValue: number) {
      this.localValue = newValue;
    },
  },
  created() {
    this.debouncedEmitValue = debounce((value: number) => {
      this.$emit('input', { ...this.value, value });
    }, 100);
  },
  beforeUnmount() {
    if (this.debouncedEmitValue) {
      this.debouncedEmitValue.cancel();
    }
  },
  methods: {
    emitInput(eventData: IObsSliderInputValue) {
      this.$emit('input', eventData);
    },
    updateValue(value: number) {
      this.localValue = value;
      this.emitValue(value);
    },
    emitValue(value: number) {
      if (this.debouncedEmitValue) this.debouncedEmitValue(value);
    },
  },
});
export default Object.assign(ObsSliderInput, { obsType: 'OBS_PROPERTY_SLIDER' as TObsType });
