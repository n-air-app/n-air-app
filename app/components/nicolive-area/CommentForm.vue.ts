import { Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { CommentModifier } from 'services/nicolive-program/NicoliveClient';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { TranscriptionService } from 'services/transcription/transcription';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({})
export default class CommentForm extends Vue {
  @Inject()
  nicoliveProgramService: NicoliveProgramService;
  @Inject()
  private transcriptionService: TranscriptionService;

  isCommentSending: boolean = false;
  operatorCommentValue: string = '';

  transcriptionSubscription: Subscription;
  mounted() {
    this.transcriptionSubscription = this.transcriptionService.text$.subscribe({
      next: async (text: string) => {
        if (text.length === 0) return;
        if (!this.isSendable) return; // TODO queueing?
        await this.sendTranscribedComment(text);
      },
      error: (error: Error) => {
        console.error('Transcription error:', error);
      },
    });
  }

  beforeDestroy() {
    this.transcriptionSubscription?.unsubscribe();
  }

  get isSendable(): boolean {
    return !this.isCommentSending && !this.programEnded;
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

  async sendTranscribedComment(text: string) {
    try {
      this.isCommentSending = true;
      // TODO fix: サーバー側で投稿APIが使える様になるまでは放送者コメントで代用する
      const useOperatorComment = true;
      if (useOperatorComment) {
        const isPermanent = false;
        await this.nicoliveProgramService.sendOperatorComment(text, isPermanent);
      } else {
        const now = new Date();
        const vpos = this.nicoliveProgramService.getVposFromDate(now);
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
