import { OnboardingService } from 'services/onboarding';
import { defineComponent } from 'vue';

import Connect from './onboarding_steps/Connect.vue';
import ObsImport from './onboarding_steps/ObsImport.vue';
import SuccessfullyImported from './onboarding_steps/SuccessfullyImported.vue';

export default defineComponent({
  name: 'Onboarding',

  components: {
    Connect,
    ObsImport,
    SuccessfullyImported,
  },

  computed: {
    currentView() {
      return OnboardingService.instance().currentStep;
    },
  },
});
