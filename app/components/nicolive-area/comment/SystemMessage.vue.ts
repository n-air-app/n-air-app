import { defineComponent } from 'vue';

import { CommentBase } from './CommentBase';

export default defineComponent({
  name: 'SystemMessage',
  mixins: [CommentBase],
});
