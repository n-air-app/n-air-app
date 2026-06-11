import { defineComponent, PropType } from 'vue';

import { ISettingsSubCategory } from 'services/settings';
import GenericForm from './GenericForm.vue';

export default defineComponent({
  name: 'GenericFormGroupItem',
  components: { GenericForm },
  emits: {
    input: (_groupIndex: number, _parameters: ISettingsSubCategory['parameters']) => true,
  },
  props: {
    value: { type: Array as PropType<ISettingsSubCategory['parameters']>, required: true as const },
    groupIndex: { type: Number, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  methods: {
    onInput(newParameters: ISettingsSubCategory['parameters']) {
      this.$emit('input', this.groupIndex, newParameters);
    },
  },
});
