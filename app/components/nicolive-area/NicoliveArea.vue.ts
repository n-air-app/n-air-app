import CommentViewer from 'components/nicolive-area/CommentViewer.vue';
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

export default defineComponent({
  name: 'NicolivePanelRoot',

  components: {
    ProgramInfo,
    CommentViewer,
    ProgramStatistics,
    ToolBar,
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
