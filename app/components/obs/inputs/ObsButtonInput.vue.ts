import * as remote from '@electron/remote';
import { defineComponent, PropType } from 'vue';

import { IObsButtonInputValue, TObsType } from './ObsInput';

const ObsButtonInput = defineComponent({
  name: 'ObsButtonInput',
  emits: ['input'],
  props: {
    value: { type: Object as PropType<IObsButtonInputValue>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Button/${this.value.name}`,
    };
  },
  methods: {
    emitInput(eventData: IObsButtonInputValue) {
      this.$emit('input', eventData);
    },
    handleClick() {
      if (this.value.type === 'NAIR_PROPERTY_LINK_BUTTON') {
        if (this.value.url) remote.shell.openExternal(this.value.url);
        return;
      }
      if (this.value.onClick) {
        this.value.onClick();
      }
      this.emitInput({ ...this.value, value: true });
    },
  },
});
export default Object.assign(ObsButtonInput, { obsType: ['OBS_PROPERTY_BUTTON', 'NAIR_PROPERTY_LINK_BUTTON'] as TObsType[] });
