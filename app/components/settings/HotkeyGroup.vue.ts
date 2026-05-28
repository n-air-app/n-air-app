import Hotkey from 'components/shared/Hotkey.vue';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'HotkeyGroup',
  components: { Hotkey },
  props: {
    title: String,
    hotkeys: Array,
  },
  data() {
    return {
      collapsed: false,
    };
  },
});

