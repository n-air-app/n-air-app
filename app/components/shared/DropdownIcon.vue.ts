import Dropdown from 'components/shared/Dropdown.vue';
import { defineComponent } from 'vue';

interface Item {
  id: string;
  name: string;
  icon?: string;
}

export default defineComponent({
  name: 'DropdownIcon',

  components: { Dropdown },

  props: {
    value: { type: Object as () => Item | null, default: null },
    options: { type: Array as () => Item[], required: true },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    searchable: { type: Boolean, default: false },
  },
});
