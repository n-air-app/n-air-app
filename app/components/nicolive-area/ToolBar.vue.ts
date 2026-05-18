import * as remote from '@electron/remote';
import Popper from 'components/shared/Popper.vue';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { NicoliveCommentViewerService } from 'services/nicolive-program/nicolive-comment-viewer';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { StreamingService } from 'services/streaming';
import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';

@Component({
  components: { Popper },
})
export default class ToolBar extends Vue {
  @Inject()
    nicoliveProgramService: NicoliveProgramService;
  @Inject() nicoliveCommentViewerService: NicoliveCommentViewerService;
  @Inject() streamingService: StreamingService;

  // TODO: 後で言語ファイルに移動する
  fetchTooltip = '番組再取得';
  extensionTooltip = '延長設定';
  startButtonSelectorTooltip = '配信開始/終了ボタンを選択';

  showPopupMenu: boolean = false;
  selectedButton: 'start' | 'end' | 'create' | 'release' = 'start';
  showButtonSelector: boolean = false;

  private defaultButtonForStatus(status: string): 'start' | 'end' | 'create' {
    switch (status) {
      case 'onAir':
      case 'reserved':
        return 'end';
      case 'end':
        return 'create';
      default:
        return 'start';
    }
  }

  selectButton(button: 'start' | 'end' | 'create' | 'release') {
    this.selectedButton = button;
  }

  get dropdownOptions(): Array<{ key: 'start' | 'end' | 'create' | 'release'; name: string; description: string }> {
    const status = this.programStatus;
    const options: Array<{ key: 'start' | 'end' | 'create' | 'release'; name: string; description: string }> = [];

    if (status === 'test') {
      options.push(
        { key: 'start', name: '番組開始', description: '番組を開始して視聴者に公開します' },
        { key: 'end', name: '番組終了', description: '番組を視聴者に公開せず終了します' },
      );
    } else if (status === 'reserved') {
      options.push({ key: 'end', name: '番組終了', description: '番組を終了します' });
    } else if (status === 'end') {
      options.push({ key: 'create', name: '番組作成', description: '新しく番組を作成します' });
    }

    if (status !== 'onAir') {
      options.push({ key: 'release', name: '戻る', description: '番組の作成・取得画面に戻ります' });
    }

    return options;
  }

  get isOnAir(): boolean {
    return this.nicoliveProgramService.state.status === 'onAir';
  }

  format(timeInSeconds: number): string {
    return NicoliveProgramService.format(timeInSeconds);
  }

  async createProgram() {
    try {
      return await this.nicoliveProgramService.createProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.selectButton('start');
    }
  }

  get isFetching(): boolean {
    return this.nicoliveProgramService.state.isFetching;
  }
  async fetchProgram(): Promise<void> {
    if (this.isFetching) throw new Error('fetchProgram is running');
    try {
      await this.nicoliveProgramService.fetchProgram();
      // 番組情報取得時にコメント接続も更新する
      await this.nicoliveCommentViewerService.refreshConnection();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    }
  }

  get isExtending(): boolean {
    return this.nicoliveProgramService.state.isExtending;
  }
  async extendProgram() {
    if (this.isExtending) throw new Error('extendProgram is running');
    try {
      return await this.nicoliveProgramService.extendProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    }
  }

  toggleAutoExtension() {
    this.nicoliveProgramService.toggleAutoExtension();
  }

  get programStatus(): string {
    return this.nicoliveProgramService.state.status;
  }

  get programEndTime(): number {
    return this.nicoliveProgramService.state.endTime;
  }

  get programStartTime(): number {
    return this.nicoliveProgramService.state.startTime;
  }

  get isProgramExtendable() {
    return (
      this.nicoliveProgramService.isProgramExtendable && this.programEndTime - this.currentTime > 60
    );
  }

  get autoExtensionEnabled() {
    return this.nicoliveProgramService.state.autoExtensionEnabled;
  }

  currentTime: number = NaN;
  updateCurrentTime() {
    this.currentTime = Math.floor(this.nicoliveProgramService.correctedNowMs() / 1000);
  }

  get programCurrentTime(): number {
    return this.currentTime - this.programStartTime;
  }

  get programTotalTime(): number {
    return this.programEndTime - this.programStartTime;
  }

  @Watch('programStatus')
  onStatusChange(newValue: string, oldValue: string) {
    this.selectedButton = this.defaultButtonForStatus(newValue);
    if (newValue === 'end') {
      clearInterval(this.timeTimer);
      this.currentTime = NaN;
    } else if (oldValue === 'end') {
      clearInterval(this.timeTimer);
      this.startTimer();
    }
  }

  startTimer() {
    this.timeTimer = setInterval(() => this.updateCurrentTime(), 1000) as any as number;
  }

  timeTimer: number = 0;
  mounted() {
    this.selectedButton = this.defaultButtonForStatus(this.programStatus);
    if (this.programStatus !== 'end') {
      this.startTimer();
    }
  }

  get isStarting(): boolean {
    return this.nicoliveProgramService.state.isStarting;
  }
  async startProgram() {
    if (this.isStarting) throw new Error('startProgram is running');
    try {
      // もし配信開始してなかったら確認する
      let startStreaming = false;
      if (!this.streamingService.isStreaming) {
        // TODO: 翻訳
        const selectedId = await remote.dialog
          .showMessageBox(remote.getCurrentWindow(), {
            type: 'warning',
            message: $t('program-info.start-streaming-confirmation'),
            buttons: [$t('streaming.goLive'), $t('program-info.later'), $t('common.cancel')],
            noLink: true,
            cancelId: 2,
          })
          .then((value) => value.response);
        if (selectedId === 2) {
          return;
        }
        startStreaming = selectedId === 0;
      }
      await this.nicoliveProgramService.startProgram();
      if (startStreaming) {
        // 開始
        await this.streamingService.toggleStreamingAsync();
      }
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    }
  }
  get isEnding(): boolean {
    return this.nicoliveProgramService.state.isEnding;
  }
  async endProgram() {
    if (this.isEnding) throw new Error('endProgram is running');
    try {
      // TODO: 翻訳
      const isOk = await remote.dialog
        .showMessageBox(remote.getCurrentWindow(), {
          type: 'warning',
          message: '番組を終了しますか？',
          buttons: ['終了する', $t('common.cancel')],
          noLink: true,
          cancelId: 1,
        })
        .then((value) => value.response === 0);

      if (isOk) {
        return await this.nicoliveProgramService.endProgram();
      }
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        // 終了済み番組を終了しようとした場合は黙って番組情報を更新する
        if (caught.type === 'http_error' && caught.reason === '409') {
          return this.refreshProgram();
        }
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    }
  }

  async releaseProgram() {
    const status = this.nicoliveProgramService.state.status;

    if (status === 'test') {
      const isOk = await remote.dialog
        .showMessageBox(remote.getCurrentWindow(), {
          type: 'warning',
          message: 'テスト中の番組の取得を解除して最初の画面に戻りますか？',
          buttons: ['戻る', $t('common.cancel')],
          noLink: true,
          cancelId: 1,
        })
        .then((value) => value.response === 0);
      if (!isOk) return;
    }

    this.nicoliveProgramService.releaseProgram();
  }

  private async refreshProgram() {
    try {
      await this.nicoliveProgramService.refreshProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    }
  }
}
