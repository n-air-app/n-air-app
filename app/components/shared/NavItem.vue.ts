import { defineComponent } from 'vue';

interface INavMenu {
  value: string;
  setValue: (value: string) => void;
  isChild: boolean;
}

export default defineComponent({
  name: 'NavItem',

  props: {
    to: { type: String },
    ico: { type: String },
    enabled: { type: Boolean, default: true },
    showArrow: { type: Boolean, default: false },
    isTocOpen: { type: Boolean, default: true },
  },

  data() {
    return {
      expanded: false,
    };
  },

  computed: {
    value(): string {
      return this.rootNavMenu.value;
    },

    isSubItem(): boolean {
      return this.parent.isChild;
    },

    parent(): INavMenu {
      return this.$parent as unknown as INavMenu;
    },

    rootNavMenu(): INavMenu {
      function getRoot(element: any): any {
        if (
          element.$options?.name === 'NavMenu'
          && !(element.$parent?.$options?.name === 'NavItem')
        ) {
          return element;
        }
        return getRoot(element.$parent);
      }
      return getRoot(this) as INavMenu;
    },

    expandable(): boolean {
      return !!('children' in this.$slots);
    },
  },

  methods: {
    onClickHandler(event: MouseEvent) {
      if (!this.enabled) return;
      if (this.expandable) {
        this.expanded = !this.expanded;
        return;
      }
      this.rootNavMenu.setValue(this.to ?? '');
      event.stopPropagation();
    },

    onIconClickHandler(event: MouseEvent) {
      if (!this.enabled) return;
      this.$emit('iconClick', this.to);
      event.stopPropagation();
    },
  },
});
