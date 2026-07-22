import Popper from 'components/shared/Popper.vue';
import { CustomizationService } from 'services/customization';
import { defineComponent } from 'vue';

export interface IArea {
  name: string;
  slotName: string;
  defaultSelected?: boolean;
  text: string;
}

export default defineComponent({
  name: 'AreaSwitcher',

  components: { Popper },

  props: {
    contents: { type: Array as () => IArea[], required: true as const },
  },

  data() {
    const contents = this.contents as IArea[];
    return {
      selectedContent: (contents.find((c) => c.defaultSelected) ?? contents[0]) as IArea,
    };
  },

  computed: {
    isCompactMode(): boolean {
      return CustomizationService.instance().state.compactMode;
    },

    activeContent(): IArea {
      return this.isCompactMode
        ? (this.contents as IArea[])[0]
        : this.selectedContent;
    },
  },

  methods: {
    select(slotName: string) {
      this.selectedContent = (this.contents as IArea[]).find((c) => c.slotName === slotName)!;
    },
  },
});
