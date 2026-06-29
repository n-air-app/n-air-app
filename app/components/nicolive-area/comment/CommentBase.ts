import { ChatMessage } from 'services/nicolive-program/ChatMessage';
import { getDisplayText } from 'services/nicolive-program/ChatMessage/displaytext';
import { getDisplayName } from 'services/nicolive-program/ChatMessage/getDisplayName';
import { WrappedChatWithComponent } from 'services/nicolive-program/WrappedChat';
import { defineComponent, PropType } from 'vue';

export const CommentBase = defineComponent({
  props: {
    chat: { type: Object as PropType<WrappedChatWithComponent>, required: true as const },
    getFormattedLiveTime: { type: Function as PropType<(chat: ChatMessage) => string>, required: true as const },
  },
  computed: {
    computedContent(): string {
      return getDisplayText(this.chat);
    },
    computedName(): string {
      return getDisplayName(this.chat);
    },
    computedTitle(): string {
      return `${this.computedContent} (${this.getFormattedLiveTime(this.chat.value)})`;
    },
  },
});
