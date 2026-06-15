import { defineComponent } from 'vue';

export default defineComponent({
  name: 'NavMenu',

  props: {
    value: { type: String },
  },

  computed: {
    isChild(): boolean {
      return (this.$parent as any)?.$options?.name === 'NavItem';
    },
  },

  methods: {
    setValue(value: string) {
      this.$emit('input', value);
    },
  },
});
