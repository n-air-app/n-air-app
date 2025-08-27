import { Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { CommentModifier } from 'services/nicolive-program/NicoliveClient';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { TimestampedText, TranscriptionService } from 'services/transcription/transcription';
import { ScheduledExecutionQueue } from 'util/ScheduledExecutionQueue';
import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';

@Component({})
export default class CommentForm extends Vue {
  @Inject()
  nicoliveProgramService: NicoliveProgramService;
  @Inject()
  private transcriptionService: TranscriptionService;

  isCommentSending: boolean = false;
  operatorCommentValue: string = '';

  commentQueue: ScheduledExecutionQueue<TimestampedText> | null = null;

  queueComment(timestampedText: TimestampedText) {
    this.commentQueue.add(
      timestampedText,
      new Date(Date.now() + this.transcriptionService.state.commentDelay),
    );
  }

  transcriptionSubscription: Subscription;
  mounted() {
    this.commentQueue = new ScheduledExecutionQueue<TimestampedText>(
      async (item: TimestampedText) => {
        if (!this.isSendable) {
          return false;
        }
        try {
          await this.sendTranscribedComment(item.text, new Date(item.timestamp));
        } catch (e) {
          console.error('Error sending transcribed comment:', e); // TODO DEBUG
        }
        return true;
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
  }

  beforeDestroy() {
    this.transcriptionSubscription?.unsubscribe();
    this.commentQueue?.destroy();
  }

  get isSendable(): boolean {
    return !this.isCommentSending && !this.programEnded;
  }

  @Watch('isSendable')
  onIsSendableChanged(isSendable: boolean) {
    if (isSendable) {
      this.commentQueue?.resume();
    }
  }

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
  }

  async sendTranscribedComment(text: string, estimatedStartSpeaking: Date) {
    try {
      this.isCommentSending = true;
      // TODO fix: サーバー側で投稿APIが使える様になるまでは放送者コメントで代用する
      const useOperatorComment = true;
      if (useOperatorComment) {
        const isPermanent = false;
        await this.nicoliveProgramService.sendOperatorComment(text, isPermanent);
      } else {
        const vpos = this.nicoliveProgramService.getVposFromDate(estimatedStartSpeaking);
        // TODO コメント装飾をどうするか
        const modifier: CommentModifier = {
          position: 'shita',
        };
        await this.nicoliveProgramService.sendNormalComment(text, vpos, modifier);
      }
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.isCommentSending = false;
    }
  }

  get programEnded(): boolean {
    return this.nicoliveProgramService.state.status === 'end';
  }
}
