import { defineComponent, inject, provide } from 'vue';

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

type GetTocSectionIdFn = () => string;
type RegisterTocSectionFn = (data: TocSectionData) => string;
type UnregisterTocSectionFn = (categoryName: string, sectionId: string) => void;

export default defineComponent({
  name: 'TocSection',

  props: {
    title: { type: String, required: true },
    id: { type: String },
    level: { type: Number },
    visible: { type: Boolean, default: true },
  },

  setup(props) {
    const getTocSectionId = inject<GetTocSectionIdFn>('getTocSectionId');
    const registerTocSection = inject<RegisterTocSectionFn>('registerTocSection');
    const unregisterTocSection = inject<UnregisterTocSectionFn>('unregisterTocSection');
    const parentTocLevel = inject<number | undefined>('tocLevel', undefined);

    // compute level once and provide to child TocSections (mirrors original static provide())
    let computedLevel: number;
    if (props.level !== undefined) {
      computedLevel = props.level;
    } else if (parentTocLevel !== undefined) {
      computedLevel = parentTocLevel + 1;
    } else {
      computedLevel = 1;
    }
    provide('tocLevel', computedLevel);

    return {
      getTocSectionId,
      registerTocSection,
      unregisterTocSection,
      parentTocLevel,
    };
  },

  data() {
    return {
      generatedId: undefined as string | undefined,
      registeredCategoryName: undefined as string | undefined,
    };
  },

  computed: {
    sectionId(): string {
      if (this.id) return this.id;
      if (!this.generatedId && this.getTocSectionId) {
        // NOTE: Vue 3 では computed 内の reactive data への書き込みは副作用となるが、
        // ID 生成は一度だけ行われる lazy initialization パターンであり実害はない。

        (this as any).generatedId = this.getTocSectionId();
      }
      return this.generatedId || '';
    },

    computedLevel(): number {
      if (this.level !== undefined) return this.level;
      if (this.parentTocLevel !== undefined) return this.parentTocLevel + 1;
      return 1;
    },
  },

  mounted() {
    if (this.visible) {
      this.$nextTick(() => {
        const register = this.registerTocSection;
        if (register && typeof register === 'function') {
          this.registeredCategoryName = register({
            id: this.sectionId,
            title: this.title,
            order: 0,
            level: this.computedLevel,
          });
        }
      });
    }
  },

  beforeUnmount() {
    if (this.registeredCategoryName) {
      this.unregisterTocSection!(this.registeredCategoryName, this.sectionId);
    }
  },

  watch: {
    visible(newVal: boolean) {
      const register = this.registerTocSection;
      const unregister = this.unregisterTocSection;
      if (!newVal) {
        if (this.registeredCategoryName) {
          unregister!(this.registeredCategoryName, this.sectionId);
          this.registeredCategoryName = undefined;
        }
      } else if (!this.registeredCategoryName && typeof register === 'function') {
        this.$nextTick(() => {
          this.registeredCategoryName = register!({
            id: this.sectionId,
            title: this.title,
            order: 0,
            level: this.computedLevel,
          });
        });
      }
    },
  },
});
