import * as remote from '@electron/remote';
import { Subscription } from 'rxjs';
import { $t } from 'services/i18n';
import { ILoudness, LoudnessLevel, loudnessLevel, LoudnessService, LoudnessStatus } from 'services/loudness';
import { Menu } from 'util/menus/Menu';
import { defineComponent } from 'vue';

// メニューで選べる目標値 (LUFS)
const TARGET_PRESETS = [-14, -15, -16, -18, -23];

export default defineComponent({
  name: 'MixerLoudness',

  data() {
    return {
      loudness: null as ILoudness | null,
      status: 'stopped' as LoudnessStatus,
      subscription: null as Subscription | null,
    };
  },

  mounted() {
    const loudnessService = LoudnessService.instance();
    this.subscription = new Subscription();
    this.subscription.add(loudnessService.loudness.subscribe((loudness) => (this.loudness = loudness)));
    this.subscription.add(loudnessService.status.subscribe((status) => (this.status = status)));
    loudnessService.enable();
  },

  beforeUnmount() {
    // 計測は止めない。コンパクトモードの切り替えなどで作り直されても、計測を続けるため
    // (止めるのはパネルを非表示に設定したとき)
    this.subscription?.unsubscribe();
  },

  computed: {
    targetLufs(): number {
      return LoudnessService.instance().targetLufs;
    },

    shortTerm(): number | null {
      return this.loudness?.shortTerm ?? null;
    },

    level(): LoudnessLevel {
      return loudnessLevel(this.shortTerm, this.targetLufs);
    },

    valueText(): string {
      return this.shortTerm === null ? '---' : this.shortTerm.toFixed(1);
    },

    message(): string {
      switch (this.level) {
        case 'low':
          return $t('audio.loudnessLow');
        case 'high':
          return $t('audio.loudnessHigh');
        case 'ok':
          return $t('audio.loudnessOk');
        default:
          return '';
      }
    },

    tooltip(): string {
      return $t('audio.loudnessTooltip');
    },
  },

  methods: {
    closePanel() {
      LoudnessService.instance().setShowPanel(false);
      void remote.dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'info',
        message: $t('audio.loudnessHidden'),
        buttons: [$t('common.ok')],
      });
    },

    showMenu() {
      const service = LoudnessService.instance();
      const menu = new Menu();
      TARGET_PRESETS.forEach((target) => {
        menu.append({
          id: `Loudness target ${target}`,
          label: $t(
            target === LoudnessService.defaultState.targetLufs
              ? 'audio.loudnessTargetDefaultItem'
              : 'audio.loudnessTargetItem',
            { target },
          ),
          type: 'radio',
          checked: service.targetLufs === target,
          click: () => service.setTargetLufs(target),
        });
      });
      menu.append({ type: 'separator' });
      menu.append({
        id: 'Loudness hide',
        label: $t('audio.loudnessHide'),
        click: () => this.closePanel(),
      });
      menu.popup();
    },
  },
});
