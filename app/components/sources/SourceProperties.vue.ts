import * as remote from '@electron/remote';
import GenericForm from 'components/obs/inputs/GenericForm.vue';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import TextTranscriptionProperties from 'components/sources/TextTranscriptionProperties.vue';
import cloneDeep from 'lodash/cloneDeep';
import { Subscription } from 'rxjs';
import { AppService } from 'services/app';
import { $t } from 'services/i18n';
import { SourcesService, TSourceType } from 'services/sources';
import Util from 'services/utils';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

const PeriodicUpdateSources: TSourceType[] = ['ndi_source', 'custom_cast_ndi_source'];
const PeriodicUpdateInterval = 5000; // in Milliseconds

export default defineComponent({
  name: 'SourceProperties',

  components: {
    ModalLayout,
    Display,
    GenericForm,
    TextTranscriptionProperties,
  },

  data() {
    return {
      properties: [] as TObsFormData,
      initialProperties: [] as TObsFormData,
      tainted: false,
      sourceRemovedSub: null as Subscription | null,
      sourceUpdatedSub: null as Subscription | null,
      refreshTimer: undefined as number | undefined,
    };
  },

  computed: {
    windowId(): string {
      return Util.getCurrentUrlParams().windowId;
    },

    sourceId(): string {
      // このビューはoneOffWindow と childWindow どちらからも開かれる可能性があるため
      // どちらか有効な方のクエリパラメータから sourceId を取得する
      return (
        WindowsService.instance().getWindowOptions(this.windowId).sourceId
        || WindowsService.instance().getChildWindowQueryParams().sourceId
      );
    },

    source() {
      return SourcesService.instance().getSource(this.sourceId);
    },

    isShuttingDown(): boolean {
      return AppService.instance().state.shuttingDown;
    },

    propertiesManagerUI(): string | undefined {
      if (this.source) return this.source.getPropertiesManagerUI();
      return undefined;
    },

    windowTitle(): string {
      const source = SourcesService.instance().getSource(this.sourceId);
      return source ? $t('sources.propertyWindowTitle', { sourceName: source.name }) : '';
    },
  },

  mounted(): void {
    this.properties = this.source ? this.source.getPropertiesFormData() : [];
    this.initialProperties = cloneDeep(this.properties);
    this.sourceRemovedSub = SourcesService.instance().sourceRemoved.subscribe((source) => {
      if (source.sourceId === this.sourceId) {
        remote.getCurrentWindow().close();
      }
    });
    this.sourceUpdatedSub = SourcesService.instance().sourceUpdated.subscribe((source) => {
      if (source.sourceId === this.sourceId) {
        this.refresh();
      }
    });

    if (PeriodicUpdateSources.includes(this.source.type)) {
      this.refreshTimer = window.setInterval(() => {
        const source = SourcesService.instance().getSource(this.sourceId);
        source.setPropertiesFormData([this.properties[0]]);
        this.refresh();
      }, PeriodicUpdateInterval);
    }
    WindowsService.instance().requireWaitWindowCleanup(this.windowId, true);
  },

  unmounted(): void {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }
    this.sourceRemovedSub.unsubscribe();
    this.sourceUpdatedSub.unsubscribe();
    WindowsService.instance().requireWaitWindowCleanup(this.windowId, false);
  },

  methods: {
    onInputHandler(properties: TObsFormData, changedIndex: number): void {
      const source = SourcesService.instance().getSource(this.sourceId);
      source.setPropertiesFormData([properties[changedIndex]]);
      this.tainted = true;
    },

    refresh(): void {
      this.properties = this.source.getPropertiesFormData();
    },

    closeWindow(): void {
      WindowsService.instance().closeChildWindow();
    },

    done(): void {
      this.closeWindow();
    },

    cancel(): void {
      if (this.tainted) {
        const source = SourcesService.instance().getSource(this.sourceId);
        source.setPropertiesFormData(this.initialProperties);
      }
      this.closeWindow();
    },
  },
});
