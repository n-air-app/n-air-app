import { defineComponent, PropType } from 'vue';

import { IObsNumberInputValue, TObsType } from './ObsInput';

const ObsIntInput = defineComponent({
  name: 'ObsIntInput',
  emits: ['input'],
  props: {
    value: { type: Object as PropType<IObsNumberInputValue>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Int/${this.value.name}`,
    };
  },
  methods: {
    emitInput(eventData: IObsNumberInputValue) {
      this.$emit('input', eventData);
    },
    updateValue(eventOrValue: Event | string) {
      if (this.value.enabled === false) return;
      const value = eventOrValue instanceof Event
        ? (eventOrValue.target as HTMLInputElement).value
        : eventOrValue;
      let formattedValue = String(isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10));
      if (this.value.type === 'OBS_PROPERTY_UINT' && Number(formattedValue) < 0) {
        formattedValue = '0';
      }
      if (this.value.minVal !== undefined && Number(formattedValue) < this.value.minVal) {
        formattedValue = String(this.value.minVal);
      }
      if (this.value.maxVal !== undefined && Number(formattedValue) > this.value.maxVal) {
        formattedValue = String(this.value.maxVal);
      }
      const input = (this.$refs.input as HTMLInputElement);
      if (formattedValue !== value) {
        input.value = formattedValue;
      }
      this.emitInput({ ...this.value, value: Number(formattedValue) });
    },
    increment() {
      if (this.value.enabled === false) return;
      this.updateValue(String(Number((this.$refs.input as HTMLInputElement).value) + this.value.stepVal));
    },
    decrement() {
      if (this.value.enabled === false) return;
      this.updateValue(String(Number((this.$refs.input as HTMLInputElement).value) - this.value.stepVal));
    },
    onMouseWheelHandler(event: WheelEvent) {
      if (this.value.enabled === false) return;
      const input = this.$refs.input as HTMLInputElement;
      const canChange = event.target !== input || input === document.activeElement;
      if (!canChange) return;
      if (event.deltaY > 0) this.decrement();
      else this.increment();
      event.preventDefault();
    },
  },
});
export default Object.assign(ObsIntInput, { obsType: ['OBS_PROPERTY_INT', 'OBS_PROPERTY_UINT'] as TObsType[] });
