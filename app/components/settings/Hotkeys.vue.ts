import TocSection from 'components/shared/TocSection.vue';
import { HotkeysService, IHotkeysSet } from 'services/hotkeys';
import { ScenesService } from 'services/scenes';
import { SourcesService } from 'services/sources';
import { defineComponent } from 'vue';

import HotkeyGroup from './HotkeyGroup.vue';

export default defineComponent({
  name: 'Hotkeys',
  components: { HotkeyGroup, TocSection },
  data() {
    return {
      hotkeySet: {
        general: [],
        sources: {},
        scenes: {},
      } as IHotkeysSet,
    };
  },
  computed: {
    sources() {
      return SourcesService.instance().sources;
    },
  },
  mounted() {
    // We don't want hotkeys registering while trying to bind.
    // We may change our minds on this in the future.
    HotkeysService.instance().unregisterAll();

    // Render a blank page before doing synchronous IPC
    setTimeout(() => (this.hotkeySet = HotkeysService.instance().getHotkeysSet()), 100);
  },
  unmounted() {
    HotkeysService.instance().applyHotkeySet(this.hotkeySet);
  },
  methods: {
    getSceneName(sceneId: string): string {
      return ScenesService.instance().getScene(sceneId)!.name;
    },
    getSourceName(sourceId: string): string {
      return SourcesService.instance().getSource(sourceId)!.name;
    },
  },
});

