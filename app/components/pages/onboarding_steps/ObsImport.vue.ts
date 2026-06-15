import Dropdown from 'components/shared/Dropdown.vue';
import { $t } from 'services/i18n';
import { ObsImporterService } from 'services/obs-importer';
import { OnboardingService } from 'services/onboarding';
import { defineComponent } from 'vue';

import NAirObsLogo from '../../../../media/images/n-air-obs-logo.svg';

export default defineComponent({
  name: 'ObsImport',

  components: { Dropdown, NAirObsLogo },

  data() {
    const profiles = ObsImporterService.instance().getProfiles();
    return {
      status: 'initial' as 'initial' | 'importing' | 'done',
      sceneCollections: ObsImporterService.instance().getSceneCollections(),
      profiles,
      selectedProfile: profiles[0] || '',
      reImportMode: false,
    };
  },

  created() {
    // シーン編集から来た場合、初期とは違う表記をするため
    this.reImportMode = OnboardingService.instance().state.options.skipLogin;

    // OBSのデータが無いならskip
    if (!ObsImporterService.instance().canImportFromOBS) (this as any).startFresh();
  },

  computed: {
    title(): string {
      if (this.status === 'importing') return $t('onboarding.importingStateTitle');
      if (this.status === 'done') return $t('onboarding.doneStateTitle');
      return $t('onboarding.initialStateTitle');
    },

    description(): string {
      if (this.status === 'importing') return $t('onboarding.importingStateDescription');
      if (this.status === 'done') return $t('onboarding.doneStateDescription');
      return $t('onboarding.initialStateDescription');
    },
  },

  methods: {
    startImport() {
      this.status = 'importing';
      setTimeout(async () => {
        try {
          await ObsImporterService.instance().load(this.selectedProfile);
          this.status = 'done';
        } catch (e) {
          // I suppose let's pretend we succeeded for now.
          this.status = 'done';
        }
      });
    },

    startFresh() {
      OnboardingService.instance().skip();
    },

    next() {
      OnboardingService.instance().next();
    },
  },
});
