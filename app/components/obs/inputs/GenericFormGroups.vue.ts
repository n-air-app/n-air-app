import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { ISettingsSubCategory } from '../../../services/settings';
import GenericForm from './GenericForm.vue';
import TocSection from '../../shared/TocSection.vue';

@Component({
  components: { GenericForm, TocSection },
})
export default class GenericFormGroups extends Vue {
  @Prop()
  value: ISettingsSubCategory[];

  @Prop()
  category: string;

  @Prop()
  isLoggedIn: boolean;

  collapsedGroups: Dictionary<boolean> = {};

  toggleGroup(index: string) {
    this.$set(this.collapsedGroups, index, !this.collapsedGroups[index]);
  }

  onInputHandler() {
    this.$emit('input', this.value);
  }

  hasAnyVisibleSettings(category: ISettingsSubCategory) {
    return !!category.parameters.find(setting => {
      return setting.visible;
    });
  }

  getUntitledSectionTitle(formGroup: ISettingsSubCategory): string {
    // For Untitled groups, use the first visible parameter's description as the title
    const firstVisibleParam = formGroup.parameters.find(p => p.visible);
    if (firstVisibleParam && firstVisibleParam.description) {
      return firstVisibleParam.description;
    }
    // Fallback to category name
    return this.category || 'Settings';
  }

  get isSimpleCategory(): boolean {
    // Categories with few settings that don't need TOC
    return ['Stream', 'Audio', 'Video'].includes(this.category);
  }
}
