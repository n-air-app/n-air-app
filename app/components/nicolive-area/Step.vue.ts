import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Step',

  props: {
    title: { type: String },
    description: { type: String },
  },
});
