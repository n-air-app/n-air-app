import MixerItem from 'components/studio/MixerItem.vue';
import MixerLoudness from 'components/studio/MixerLoudness.vue';
import { AudioService } from 'services/audio';
import { CompactModeService } from 'services/compact-mode';
import { $t } from 'services/i18n';
import { LoudnessService } from 'services/loudness';
import { Menu } from 'util/menus/Menu';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Mixer',

  components: { MixerItem, MixerLoudness },

  data() {
    return {
      advancedSettingsTooltip: $t('audio.advancedSettingsTooltip'),
      mixerTooltip: $t('audio.mixerTooltip'),
    };
  },

  computed: {
    showLoudnessPanel(): boolean {
      return LoudnessService.instance().showPanel;
    },

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
      const menu = new Menu();
      menu.append({
        id: 'Unhide All',
        label: $t('sources.unhideAll'),
        click: () => AudioService.instance().unhideAllSourcesForCurrentScene(),
      });
      menu.popup();
    },
  },
});
