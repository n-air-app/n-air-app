import { Inject } from 'services/core/injector';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

import AreaSwitcher, { IArea } from 'components/nicolive-area/AreaSwitcher.vue';
import CommentFilter from 'components/nicolive-area/CommentFilter.vue';
import CommentViewer from 'components/nicolive-area/CommentViewer.vue';
import ProgramDescription from 'components/nicolive-area/ProgramDescription.vue';
import ProgramInfo from 'components/nicolive-area/ProgramInfo.vue';
import ProgramStatistics from 'components/nicolive-area/ProgramStatistics.vue';
import ToolBar from 'components/nicolive-area/ToolBar.vue';
import PerformanceMetrics from 'components/studio/PerformanceMetrics.vue';
import { CustomizationService } from 'services/customization';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import ControlsArrow from '../../../media/images/controls-arrow-vertical.svg';

const CREATED_NOTICE_DURATION = 5000; // 番組作成通知の表示時間(ミリ秒)

@Component({
  components: {
    AreaSwitcher,
    ProgramInfo,
    ProgramDescription,
    CommentViewer,
    CommentFilter,
    ProgramStatistics,
    ToolBar,
    ControlsArrow,
    PerformanceMetrics,
  },
})
export default class NicolivePanelRoot extends Vue {
  @Inject()
  nicoliveProgramService: NicoliveProgramService;
  @Inject() private customizationService: CustomizationService;

  destroyed() {
    this.nicoliveProgramService.hidePlaceholder();
  }

  get contents(): IArea[] {
    return [
      {
        name: 'コメント',
        text: '番組に投稿されたコメントを閲覧します',
        slotName: 'commentViewer',
      },
      {
        name: '番組説明文',
        text: '番組作成時に設定した説明文の表示を確認します',
        slotName: 'description',
      },
    ];
  }

  get opened(): boolean {
    return this.nicoliveProgramService.state.panelOpened;
  }

  onToggle(): void {
    this.nicoliveProgramService.togglePanelOpened();
  }

  get isCompactMode(): boolean {
    return this.customizationService.state.compactMode;
  }

  async createProgram(): Promise<void> {
    try {
      await this.nicoliveProgramService.createProgram();
    } catch (e) {
      console.error(e);
    }
  }

  isFetching: boolean = false;
  async fetchProgram(): Promise<void> {
    if (this.isFetching) throw new Error('fetchProgram is running');
    try {
      this.isFetching = true;
      await this.nicoliveProgramService.fetchProgram();
    } catch (caught) {
      if (caught instanceof NicoliveFailure) {
        await openErrorDialogFromFailure(caught);
      } else {
        throw caught;
      }
    } finally {
      this.isFetching = false;
    }
  }

  get hasProgram(): boolean {
    return this.nicoliveProgramService.hasProgram;
  }

  get showPlaceholder(): boolean {
    return this.nicoliveProgramService.isShownPlaceholder;
  }
}
