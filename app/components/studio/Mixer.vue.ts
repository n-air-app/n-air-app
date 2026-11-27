import MixerItem from 'components/studio/MixerItem.vue';
import { AudioService } from 'services/audio';
import { CompactModeService } from 'services/compact-mode';
import { $t } from 'services/i18n';
import { Menu } from 'util/menus/Menu';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Mixer',

  components: { MixerItem },

  data() {
    return {
      advancedSettingsTooltip: $t('audio.advancedSettingsTooltip'),
      mixerTooltip: $t('audio.mixerTooltip'),
    };
  },

  computed: {
    audioSources() {
      return AudioService.instance().getVisibleSourcesForCurrentScene();
    },

    isCompactMode(): boolean {
      return CompactModeService.instance().isCompactMode;
    },
  },

  methods: {
    showAdvancedSettings() {
      AudioService.instance().showAdvancedSettings();
    },

    handleRightClick() {
      const audioService = AudioService.instance();
      const hiddenSources = audioService.getHiddenSourcesForCurrentScene();

      // 非表示ソースがなければメニューを出さない
      if (hiddenSources.length === 0) {
        return;
      }

      const menu = new Menu();

      // 非表示ソースが1つの場合は直接表示する項目を出す
      if (hiddenSources.length === 1) {
        const source = hiddenSources[0];
        menu.append({
          id: `Unhide ${source.sourceId}`,
          label: `${$t('sources.showHiddenSource')}: ${source.name}`,
          click: () => source.setHidden(false),
        });
      } else {
        // 複数の場合はサブメニューで個別選択可能に
        const submenu = new Menu();
        // 個別のソース
        hiddenSources.forEach((source) => {
          submenu.append({
            id: `Unhide ${source.sourceId}`,
            label: source.name,
            click: () => source.setHidden(false),
          });
        });
        // セパレーター
        submenu.append({ type: 'separator' });
        // すべて表示
        submenu.append({
          id: 'Unhide All',
          label: $t('sources.unhideAll'),
          click: () => audioService.unhideAllSourcesForCurrentScene(),
        });

        menu.append({
          id: 'Show Hidden Sources',
          label: $t('sources.showHiddenSource'),
          submenu: submenu.menu,
        });
      }

      menu.popup();
    },
  },
});
