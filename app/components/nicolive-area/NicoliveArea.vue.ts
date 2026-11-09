import CommentViewer from 'components/nicolive-area/CommentViewer.vue';
import ProgramInfo from 'components/nicolive-area/ProgramInfo.vue';
import ProgramStatistics from 'components/nicolive-area/ProgramStatistics.vue';
import ToolBar from 'components/nicolive-area/ToolBar.vue';
import PerformanceMetrics from 'components/studio/PerformanceMetrics.vue';
import { DateTime } from 'luxon';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
import {
  NicoliveProgramService,
  ScheduleSummary,
  ScheduleSummaryItem,
} from 'services/nicolive-program/nicolive-program';
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
      isLoadingSummary: false,
      summary: null as ScheduleSummary | null,
      summaryError: false,
      // N Air で終了した番組のID。終了直後は番組表APIがまだ放送中を返すことがあるため除外する
      endedProgramId: '' as string,
      onWindowFocus: null as (() => void) | null,
    };
  },

  mounted() {
    this.onWindowFocus = () => {
      if (!this.hasProgram) this.refreshSummary();
    };
    window.addEventListener('focus', this.onWindowFocus);
    this.refreshSummary();
  },

  watch: {
    // 番組が解放されて初期画面に戻ったときも再取得する
    hasProgram(has: boolean) {
      if (!has) {
        // 古い概要を見せないよう、いったん捨ててから再取得する
        this.summary = null;
        this.refreshSummary();
      }
    },

    programStatus(status: string) {
      if (status === 'end') {
        this.endedProgramId = NicoliveProgramService.instance().state.programID;
      }
    },
  },

  unmounted() {
    if (this.onWindowFocus) window.removeEventListener('focus', this.onWindowFocus);
    NicoliveProgramService.instance().hidePlaceholder();
  },

  computed: {
    opened(): boolean {
      return NicoliveProgramService.instance().state.panelOpened ?? false;
    },

    /** 放送中・テスト中の番組があるときは新規作成できない */
    hasCurrentProgram(): boolean {
      return Boolean(this.summary?.current);
    },

    isCompactMode(): boolean {
      return CustomizationService.instance().state.compactMode;
    },

    programStatus(): string {
      return NicoliveProgramService.instance().state.status;
    },

    hasProgram(): boolean {
      return NicoliveProgramService.instance().hasProgram;
    },

    showPlaceholder(): boolean {
      return NicoliveProgramService.instance().isShownPlaceholder;
    },
  },

  methods: {
    t(key: string): string {
      return $t(`nicolive-program.scheduleSummary.${key}`);
    },

    itemLabel(item: ScheduleSummaryItem): string {
      if (item.status === 'reserved') return this.t('reserved');
      return this.t(item.status === 'test' ? 'test' : 'current');
    },

    formatRange(item: ScheduleSummaryItem): string {
      const fmt = 'yyyy/MM/dd HH:mm';
      const start = DateTime.fromSeconds(item.onAirBeginAt).toFormat(fmt);
      if (item.status === 'reserved') {
        return $t('nicolive-program.scheduleSummary.reservedStart', { start });
      }
      const end = DateTime.fromSeconds(item.onAirEndAt).toFormat(fmt);
      return $t('nicolive-program.scheduleSummary.schedule', { start, end });
    },

    async refreshSummary(): Promise<void> {
      if (this.isLoadingSummary || this.isFetching || this.hasProgram) return;
      this.isLoadingSummary = true;
      try {
        const fetched = await NicoliveProgramService.instance().fetchScheduleSummary();
        const ended = this.endedProgramId;
        const exclude = (item: ScheduleSummaryItem | null) => (
          item && item.nicoliveProgramId !== ended ? item : null
        );
        this.summary = { current: exclude(fetched.current), reserved: exclude(fetched.reserved) };
        this.summaryError = false;
      } catch (caught) {
        // 自動確認の失敗ではダイアログを出さず、表示だけ控えめに知らせる
        console.warn('[NicoliveArea] fetchScheduleSummary failed', caught);
        this.summaryError = true;
      } finally {
        this.isLoadingSummary = false;
      }
    },

    onToggle(): void {
      NicoliveProgramService.instance().togglePanelOpened();
    },

    /** 既存番組の有無にかかわらず新規番組を作成する */
    async createNewProgram(): Promise<void> {
      if (this.isFetching || this.isLoadingSummary || this.hasCurrentProgram) return;
      try {
        this.isFetching = true;
        await NicoliveProgramService.instance().createProgram();
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          console.error(caught);
        }
      } finally {
        this.isFetching = false;
      }
    },

    /**
     * @param targetProgramId 指定時はその番組を取得する。未指定時は従来通り自動選択し、なければ新規作成する
     */
    async prepareProgram(targetProgramId?: string): Promise<void> {
      if (this.isFetching) throw new Error('prepareProgram is running');
      try {
        this.isFetching = true;
        let needsCreate = false;
        try {
          await NicoliveProgramService.instance().fetchProgram(targetProgramId);
          // fetchProgram 成功後でも status が end の場合は終了済み番組を掴んでいる
          // (N Air で手動終了した直後はスケジュール API がまだ onAir を返すことがある)
          // programID がセットされたままだと hasProgram=true でパネルが切り替わるためクリアする
          if (NicoliveProgramService.instance().state.status === 'end') {
            NicoliveProgramService.instance().releaseProgram();
            needsCreate = true;
          }
        } catch (caught) {
          if (
            caught instanceof NicoliveFailure
            && caught.type === 'logic'
            && caught.reason === 'no_suitable_program'
          ) {
            needsCreate = true;
          } else {
            throw caught;
          }
        }
        if (needsCreate) {
          await NicoliveProgramService.instance().createProgram();
        }
      } catch (caught) {
        if (caught instanceof NicoliveFailure) {
          await openErrorDialogFromFailure(caught);
        } else {
          console.error(caught);
        }
      } finally {
        this.isFetching = false;
      }
    },
  },
});
