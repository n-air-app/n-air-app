import Hotkey from 'components/shared/Hotkey.vue';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  props: {
    title: String,
    hotkeys: Array,
  },
  components: { Hotkey },
})
export default class HotkeyGroup extends Vue {
  collapsed = false;
}
