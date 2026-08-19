import AreaSwitcher from 'components/nicolive-area/AreaSwitcher.vue';
import type { IArea } from 'components/nicolive-area/AreaSwitcher.vue.ts';
import CommentFilter from 'components/nicolive-area/CommentFilter.vue';
import CommentViewer from 'components/nicolive-area/CommentViewer.vue';
import ProgramDescription from 'components/nicolive-area/ProgramDescription.vue';
import ProgramInfo from 'components/nicolive-area/ProgramInfo.vue';
import ProgramStatistics from 'components/nicolive-area/ProgramStatistics.vue';
import ToolBar from 'components/nicolive-area/ToolBar.vue';
import PerformanceMetrics from 'components/studio/PerformanceMetrics.vue';
import { CustomizationService } from 'services/customization';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { defineComponent } from 'vue';

import ControlsArrow from '../../../media/images/controls-arrow-vertical.svg';

const CREATED_NOTICE_DURATION = 5000; // 番組作成通知の表示時間(ミリ秒)

export default defineComponent({
  name: 'NicolivePanelRoot',

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

  data() {
    return {
      isFetching: false,
    };
  },

  unmounted() {
    NicoliveProgramService.instance().hidePlaceholder();
  },

  computed: {
    contents(): IArea[] {
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
    },

    opened(): boolean {
      return NicoliveProgramService.instance().state.panelOpened ?? false;
    },

    isCompactMode(): boolean {
      return CustomizationService.instance().state.compactMode;
    },

    hasProgram(): boolean {
      return NicoliveProgramService.instance().hasProgram;
    },

    showPlaceholder(): boolean {
      return NicoliveProgramService.instance().isShownPlaceholder;
    },
  },

  methods: {
    onToggle(): void {
      NicoliveProgramService.instance().togglePanelOpened();
    },

    async createProgram(): Promise<void> {
      try {
        await NicoliveProgramService.instance().createProgram();
      } catch (e) {
        console.error(e);
      }
    },

    async fetchProgram(): Promise<void> {
      if (this.isFetching) throw new Error('fetchProgram is running');
      try {
        this.isFetching = true;
        await NicoliveProgramService.instance().fetchProgram();
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          throw caught;
        }
      } finally {
        this.isFetching = false;
      }
    },
  },
});
