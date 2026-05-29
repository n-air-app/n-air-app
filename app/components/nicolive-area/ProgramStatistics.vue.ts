import { $t } from 'services/i18n';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ProgramStatistics',

  data() {
    return {
      visitorTooltip: $t('common.numberOfVisitors'),
      commentTooltip: $t('common.numberOfComments'),
      adPointTooltip: $t('common.numberOfadPoint'),
      giftPointTooltip: $t('common.numberOfgiftPoint'),
    };
  },

  computed: {
    viewers(): number {
      return NicoliveProgramService.instance().state.viewers;
    },

    comments(): number {
      return NicoliveProgramService.instance().state.comments;
    },

    adPoint(): number {
      return NicoliveProgramService.instance().state.adPoint;
    },

    giftPoint(): number {
      return NicoliveProgramService.instance().state.giftPoint;
    },
  },
});
