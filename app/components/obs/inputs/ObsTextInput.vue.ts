import { defineComponent, PropType } from 'vue';

import { IObsInput, IObsTextInputValue, TObsType } from './ObsInput';

const ObsTextInput = defineComponent({
  name: 'ObsTextInput',
  emits: ['input'],
  props: {
    value: { type: Object as PropType<IObsTextInputValue>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      textVisible: !this.value.masked,
      testingAnchor: `Form/Text/${this.value.name}`,
    };
  },
  methods: {
    emitInput(eventData: IObsInput<string>) {
      this.$emit('input', eventData);
    },
    toggleVisible() {
      this.textVisible = !this.textVisible;
    },
    onInputHandler(event: Event) {
      this.emitInput({ ...this.value, value: (event.target as HTMLInputElement).value });
    },
  },
});
export default Object.assign(ObsTextInput, { obsType: ['OBS_PROPERTY_EDIT_TEXT', 'OBS_PROPERTY_TEXT'] as TObsType[] });
