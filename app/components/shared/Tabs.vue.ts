import { defineComponent } from 'vue';

export interface ITab {
  name: string;
  value: string;
}

export default defineComponent({
  name: 'Tabs',

  props: {
    tabs: { type: Array as () => ITab[] },
    value: { type: String },
    className: { type: String },
    hideContent: { type: Boolean },
  },

  mounted() {
    if (!this.value) this.showTab((this.tabs as ITab[])[0].value);
  },

  methods: {
    showTab(tab: string) {
      this.$emit('input', tab);
    },
  },
});
