import { defineComponent } from 'vue';

export default defineComponent({
  name: 'AddSourceInfo',

  props: {
    sourceType: { type: String },
    showAttention: { type: Boolean, default: true },
  },
});
