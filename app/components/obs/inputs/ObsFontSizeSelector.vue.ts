import Dropdown from 'components/shared/Dropdown.vue';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ObsFontSizeSelector',
  components: { Dropdown },
  props: {
    value: { type: Number },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: 'Form/FontSize',
    };
  },
  computed: {
    fontSizePresets(): number[] {
      return [9, 10, 11, 12, 13, 14, 18, 24, 36, 48, 64, 72, 96, 144, 288];
    },
  },
  methods: {
    emitInput(eventData: number) {
      this.$emit('input', eventData);
    },
    setFontSizePreset(size: number) {
      this.emitInput(size);
    },
  },
});
