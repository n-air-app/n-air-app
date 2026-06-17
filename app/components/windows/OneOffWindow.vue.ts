import TitleBar from 'components/studio/TitleBar.vue';
import Util from 'services/utils';
import { getComponents, WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'OneOffWindow',

  components: {
    TitleBar,
    ...getComponents(),
  },

  computed: {
    windowId(): string {
      return Util.getCurrentUrlParams().windowId;
    },

    options() {
      return WindowsService.instance().state[this.windowId];
    },
  },
});
