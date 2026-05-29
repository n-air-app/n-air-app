import ModalLayout from 'components/shared/ModalLayout.vue';
import { shell } from 'electron';
import { DateTime } from 'luxon';
import { InformationsService } from 'services/informations';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export default defineComponent({
  name: 'Informations',
  components: { ModalLayout },
  computed: {
    fetching() {
      return InformationsService.instance().fetching;
    },
    hasError() {
      return InformationsService.instance().hasError;
    },
    informations() {
      return InformationsService.instance().informations;
    },
  },
  mounted() {
    InformationsService.instance().updateInformations();
    InformationsService.instance().updateLastOpen(Date.now());
  },
  methods: {
    format(unixtime: number) {
      return DateTime.fromMillis(unixtime).toFormat('yyyy-MM-dd');
    },
    isNew(unixtime: number) {
      return unixtime > Date.now() - ONE_WEEK;
    },
    handleAnchorClick(event: MouseEvent) {
      event.preventDefault();
      const url = (event.currentTarget as HTMLAnchorElement).href;
      try {
        const parsed = new URL(url);
        if (parsed.protocol.match(/https?/)) {
          shell.openExternal(parsed.href);
        }
      } catch (e) {
        console.error(e);
      }
    },
    done() {
      WindowsService.instance().closeChildWindow();
    },
  },
});

