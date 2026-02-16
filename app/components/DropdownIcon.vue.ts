import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Dropdown from './shared/Dropdown.vue';

interface Item {
  id: string;
  name: string;
  icon?: string;
}

@Component({
  components: {
    Dropdown,
  },
})
export default class DropdownIcon extends Vue {
  @Prop({ type: Object, default: null }) value: Item | null;
  @Prop({ type: Array, required: true }) options: Item[];
  @Prop({ type: Boolean, default: false }) disabled: boolean;
  @Prop({ type: Boolean, default: false }) loading: boolean;
}
