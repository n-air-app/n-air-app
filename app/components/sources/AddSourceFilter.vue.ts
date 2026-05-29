import * as inputComponents from 'components/obs/inputs';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { $t } from 'services/i18n';
import { SourceFiltersService } from 'services/source-filters';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'AddSourceFilter',

  components: { ModalLayout, ...inputComponents },

  data() {
    const sourceId = WindowsService.instance().getChildWindowQueryParams().sourceId as string;
    return {
      sourceId,
      form: SourceFiltersService.instance().getAddNewFormData(sourceId),
      availableTypes: SourceFiltersService.instance().getTypesForSource(sourceId),
      error: '',
    };
  },

  mounted(): void {
    this.setTypeAsName();
  },

  methods: {
    done(): void {
      const name = this.form.name.value;
      this.error = this.validateName(name);
      if (this.error) return;

      SourceFiltersService.instance().add(this.sourceId, this.form.type.value, name);
      SourceFiltersService.instance().showSourceFilters(this.sourceId, name);
    },

    cancel(): void {
      SourceFiltersService.instance().showSourceFilters(this.sourceId);
    },

    validateName(name: string): string {
      if (!name) return $t('common.nameIsRequiredMessage');
      if (SourceFiltersService.instance().getFilters(this.sourceId).find((filter: any) => filter.name === name)) {
        return $t('common.alreadyTakenNameMessage');
      }
      return '';
    },

    setTypeAsName(): void {
      const name = this.availableTypes.find(({ type }) => {
        return type === this.form.type.value;
      }).description;
      this.form.name.value = SourceFiltersService.instance().suggestName(this.sourceId, name);
    },
  },
});
