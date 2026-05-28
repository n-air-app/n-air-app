import * as remote from '@electron/remote';
import GenericForm from 'components/obs/inputs/GenericForm.vue';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import TocSection from 'components/shared/TocSection.vue';
import { $t, I18nService } from 'services/i18n';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'LanguageSettings',
  components: { GenericForm, TocSection },
  data() {
    return {
      settings: I18nService.instance.getLocaleFormData(),
    };
  },
  methods: {
    async save(data: TObsFormData) {
      const choice = await remote.dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'question',
        buttons: [$t('common.yes'), $t('common.no')],
        title: $t('common.confirm'),
        message: $t('settings.restartConfirm'),
        noLink: true,
        cancelId: 1,
        defaultId: 1,
      });

      if (choice.response !== 0) return;

      await I18nService.instance.setLocale(data[0].value as string);
      this.settings = I18nService.instance.getLocaleFormData();
    },
  },
});

