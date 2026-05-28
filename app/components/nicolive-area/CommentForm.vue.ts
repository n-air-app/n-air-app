import { Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { sendLogGif } from 'services/nicolive-program/nicolive-logger';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { CommentModifier } from 'services/nicolive-program/NicoliveClient';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { TimestampedText, TranscriptionService } from 'services/transcription/transcription';
import { ScheduledExecutionQueue } from 'util/ScheduledExecutionQueue';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CommentForm',

  setup() {
    // Set up service injections (works with test mocks via services/core/__mocks__/injector.ts)
    const services = {} as Record<string, any>;
    Inject()(services, 'nicoliveProgramService');
    Inject()(services, 'transcriptionService');
    return {
      nicoliveProgramService: services['nicoliveProgramService'] as NicoliveProgramService,
      transcriptionService: services['transcriptionService'] as TranscriptionService,
    };
  },

  data() {
    return {
      isCommentSending: false,
      operatorCommentValue: '',
      commentQueue: null as ScheduledExecutionQueue<TimestampedText> | null,
      transcriptionSubscription: null as Subscription | null,
    };
  },

  computed: {
    isSendable(): boolean {
      return !this.isCommentSending && !this.programEnded;
    },

    programEnded(): boolean {
      return this.nicoliveProgramService.state.status === 'end';
    },
  },

  watch: {
    isSendable(isSendable: boolean) {
      this.onIsSendableChanged(isSendable);
    },
  },

  mounted() {
    this.commentQueue = new ScheduledExecutionQueue<TimestampedText>(
      async (item: TimestampedText): Promise<boolean> => {
        const [_, result] = await Promise.all([
          !this.programEnded ? this.sendTranscribedLog(item.text) : Promise.resolve(),
          (async () => {
            if (!this.transcriptionService.state.commentEnabled) {
              return true; // コメント送信が無効なら、キューに入れないですぐに成功扱いにする
            }
            if (!this.isSendable) {
              return false;
            }
            try {
              await this.sendTranscribedComment(item.text, new Date(item.timestamp));
            } catch (e) {
              console.error('Error sending transcribed comment:', e); // TODO DEBUG
            }
            return true;
          })(),
        ]);
        return result;
      },
    );

    this.transcriptionSubscription = this.transcriptionService.text$.subscribe({
      next: async (timestampedText: TimestampedText) => {
        if (timestampedText.text.length === 0) return;
        this.queueComment(timestampedText);
      },
      error: (error: Error) => {
        console.error('Transcription error:', error);
      },
    });
  },

  beforeDestroy() {
    this.transcriptionSubscription?.unsubscribe();
    this.commentQueue?.destroy();
  },

  methods: {
    onIsSendableChanged(isSendable: boolean) {
      if (isSendable) {
        this.commentQueue?.resume();
      }
    },

    queueComment(timestampedText: TimestampedText) {
      this.commentQueue.add(
        timestampedText,
        new Date(Date.now() + this.transcriptionService.state.commentPostDelay),
      );
    },

    async sendOperatorComment(event: KeyboardEvent | MouseEvent) {
      const text = this.operatorCommentValue;
      if (text.length === 0) return;

      const isPermanent = event.ctrlKey;
      if (this.isCommentSending) throw new Error('sendOperatorComment is running');

      try {
        this.isCommentSending = true;
        await this.nicoliveProgramService.sendOperatorComment(text, isPermanent);
        this.operatorCommentValue = '';
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          throw caught;
        }
      } finally {
        this.isCommentSending = false;

        this.$nextTick(() => {
          (this.$refs.input as HTMLElement)?.focus();
        });
      }
    },

    async sendTranscribedLog(text: string) {
      sendLogGif('transcription', this.nicoliveProgramService.state.programID, {
        text,
      });
    },

    async sendTranscribedComment(text: string, estimatedStartSpeaking: Date) {
      // 放送中以外はコメントできない
      if (this.nicoliveProgramService.state.status !== 'onAir') return;
      if (text.length === 0) return;

      try {
        this.isCommentSending = true;
        const vpos = this.nicoliveProgramService.getVposFromDate(estimatedStartSpeaking);
        const modifier: CommentModifier = {
          position: this.transcriptionService.state.commentPosition,
          font: this.transcriptionService.state.commentFont,
          color: this.transcriptionService.state.commentColor,
          size: this.transcriptionService.state.commentSize,
        };
        await this.nicoliveProgramService.sendNormalComment(text, vpos, modifier);
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          throw caught;
        }
      } finally {
        this.isCommentSending = false;
      }
    },
  },
});
