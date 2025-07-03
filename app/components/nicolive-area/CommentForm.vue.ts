import { Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
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
        try {
          this.isCommentSending = true;
          // TODO 読み上げが発生しない文字起こし用のメッセージタイプを作る
          await this.nicoliveProgramService.sendOperatorComment(text, false);
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

  get programEnded(): boolean {
    return this.nicoliveProgramService.state.status === 'end';
  }
}
