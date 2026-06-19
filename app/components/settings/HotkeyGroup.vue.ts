import Hotkey from 'components/shared/Hotkey.vue';
import { IHotkey } from 'services/hotkeys';
import { defineComponent, PropType } from 'vue';

export default defineComponent({
  name: 'HotkeyGroup',
  components: { Hotkey },
  props: {
    title: String,
    hotkeys: { type: Array as PropType<IHotkey[]> },
  },
  data() {
    return {
      collapsed: false,
    };
  },
});

