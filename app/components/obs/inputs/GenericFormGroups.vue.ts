import TocSection from 'components/shared/TocSection.vue';
import { ISettingsSubCategory } from 'services/settings';
import { defineComponent, PropType, toRaw } from 'vue';

import GenericForm from './GenericForm.vue';

export default defineComponent({
  name: 'GenericFormGroups',
  components: { GenericForm, TocSection },
  props: {
    value: { type: Array as PropType<ISettingsSubCategory[]> },
    category: { type: String },
    isLoggedIn: { type: Boolean },
  },
  data() {
    return {
      collapsedGroups: {} as Dictionary<boolean>,
    };
  },
  computed: {
    isSimpleCategory(): boolean {
      return ['Stream', 'Audio', 'Video', 'General', 'Output'].includes(this.category);
    },
  },
  methods: {
    toggleGroup(index: string) {
      this.collapsedGroups[index] = !this.collapsedGroups[index];
    },
    onFormInput(groupIndex: number, newParameters: any) {
      // prop を直接変更せず、新しい配列を作って emit する
      const newValue = toRaw(this.value).map((group: ISettingsSubCategory, i: number) =>
        i === groupIndex ? { ...toRaw(group), parameters: newParameters } : toRaw(group),
      );
      this.$emit('input', newValue);
    },
    onInputHandler() {
      this.$emit('input', this.value);
    },
    hasAnyVisibleSettings(category: ISettingsSubCategory) {
      return !!category.parameters.find((setting) => setting.visible);
    },
    getUntitledSectionTitle(formGroup: ISettingsSubCategory): string {
      const firstVisibleParam = formGroup.parameters.find((p) => p.visible);
      if (firstVisibleParam && firstVisibleParam.description) {
        return firstVisibleParam.description;
      }
      return this.category || 'Settings';
    },
  },
});
