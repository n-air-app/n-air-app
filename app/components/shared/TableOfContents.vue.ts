import { defineComponent } from 'vue';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

export default defineComponent({
  name: 'TableOfContents',

  props: {
    sections: { type: Array as () => TocSectionData[], required: true },
    activeId: { type: String as () => string | null, default: null },
  },

  methods: {
    onNavigate(id: string): void {
      this.$emit('navigate', id);
    },
  },
});
