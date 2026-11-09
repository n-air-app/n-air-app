import * as remote from '@electron/remote';
import CommentViewer from 'components/nicolive-area/CommentViewer.vue';
import ProgramInfo from 'components/nicolive-area/ProgramInfo.vue';
import ProgramStatistics from 'components/nicolive-area/ProgramStatistics.vue';
import ToolBar from 'components/nicolive-area/ToolBar.vue';
import PerformanceMetrics from 'components/studio/PerformanceMetrics.vue';
import { DateTime } from 'luxon';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
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

    async prepareProgram(): Promise<void> {
      if (this.isFetching) throw new Error('prepareProgram is running');
      try {
        this.isFetching = true;
        let needsCreate = false;
        try {
          await NicoliveProgramService.instance().fetchProgram();
          const { programID, status } = NicoliveProgramService.instance().state;
          console.log('[prepareProgram] fetchProgram 成功', { programID, status });
          if (status === 'reserved') {
            const { startTime } = NicoliveProgramService.instance().state;
            console.log('[prepareProgram] 予約開始時刻', {
              startTime,
              localTime: new Date(startTime * 1000).toLocaleString('ja-JP'),
            });
            const { response } = await remote.dialog.showMessageBox(remote.getCurrentWindow(), {
              type: 'question',
              title: $t('common.confirm'),
              message: $t('nicolive-program.reservedProgram.message', {
                startTime: DateTime.fromSeconds(startTime).toFormat('yyyy/MM/dd HH:mm'),
              }),
              buttons: [
                $t('nicolive-program.reservedProgram.proceed'),
                $t('nicolive-program.reservedProgram.createNew'),
              ],
              defaultId: 0,
              cancelId: 0,
              noLink: true,
            });
            if (response === 1) {
              // N Air の取得情報だけを解放する。予約自体は削除しない。
              NicoliveProgramService.instance().releaseProgram();
              needsCreate = true;
            }
          }
          // fetchProgram 成功後でも status が end の場合は終了済み番組を掴んでいる
          // (N Air で手動終了した直後はスケジュール API がまだ onAir を返すことがある)
          // programID がセットされたままだと hasProgram=true でパネルが切り替わるためクリアする
          if (status === 'end') {
            NicoliveProgramService.instance().releaseProgram();
            needsCreate = true;
          }
        } catch (caught) {
          console.log('[prepareProgram] fetchProgram 失敗', caught);
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
