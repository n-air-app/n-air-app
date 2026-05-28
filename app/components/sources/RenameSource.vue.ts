import ModalLayout from 'components/shared/ModalLayout.vue';
import { $t } from 'services/i18n';
import { SourcesService } from 'services/sources';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'RenameSource',

  components: { ModalLayout },

  data() {
    const options = WindowsService.instance.getChildWindowQueryParams() as {
      sourceId?: string;
    };
    return {
      options,
      name: '',
      error: '',
    };
  },

  mounted(): void {
    const source = SourcesService.instance.getSource(this.options.sourceId);
    this.name = source.name;
  },

  methods: {
    submit(): void {
      if (!this.name) {
        this.error = $t('sources.sourceNameIsRequired');
      } else {
        SourcesService.instance.getSource(this.options.sourceId).setName(this.name);
        WindowsService.instance.closeChildWindow();
      }
    },
  },
});
