import { OnboardingService } from 'services/onboarding';
import { TPlatform } from 'services/platforms';
import { UserService } from 'services/user';
import { defineComponent } from 'vue';

import NAirLogo from '../../../../media/images/n-air-logo.svg';

export default defineComponent({
  name: 'Connect',

  components: { NAirLogo },

  data() {
    return {
      loadingState: false,
    };
  },

  computed: {
    isSecurityUpgrade(): boolean {
      return OnboardingService.instance().options.isSecurityUpgrade;
    },
  },

  methods: {
    authPlatform(platform: TPlatform) {
      this.loadingState = true;
      UserService.instance().startAuth({
        platform,
        onAuthClose: () => {
          this.loadingState = false;
        },
        onAuthFinish: () => {
          OnboardingService.instance().next();
        },
      });
    },

    iconForPlatform(platform: TPlatform) {
      if (this.loadingState) return 'icon-spinner icon-spin';
      return {
        niconico: 'icon-niconico',
      }[platform];
    },

    skipOnboarding() {
      OnboardingService.instance().skip();
    },
  },
});
