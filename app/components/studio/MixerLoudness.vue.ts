import * as remote from '@electron/remote';
import { Subscription } from 'rxjs';
import { $t } from 'services/i18n';
import { ILoudness, LoudnessService, LoudnessStatus } from 'services/loudness';
import { WindowsService } from 'services/windows';
import { Menu } from 'util/menus/Menu';
import { defineComponent } from 'vue';

// 目標との差がこの範囲 (LU) なら「適正」とみなす
const TOLERANCE_LU = 3;

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
    this.subscription?.unsubscribe();
    LoudnessService.instance().disable();
  },

  computed: {
    targetLufs(): number {
      return LoudnessService.instance().targetLufs;
    },

    shortTerm(): number | null {
      return this.loudness?.shortTerm ?? null;
    },

    /** 目標との差 (LU)。正なら大きすぎ、負なら小さすぎ */
    diff(): number | null {
      return this.shortTerm === null ? null : this.shortTerm - this.targetLufs;
    },

    level(): 'none' | 'low' | 'ok' | 'high' {
      if (this.diff === null) return 'none';
      if (this.diff < -TOLERANCE_LU) return 'low';
      if (this.diff > TOLERANCE_LU) return 'high';
      return 'ok';
    },

    valueText(): string {
      return this.shortTerm === null ? '---' : this.shortTerm.toFixed(1);
    },

    canAdjust(): boolean {
      return this.level === 'low' || this.level === 'high';
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

    openAdjust() {
      WindowsService.instance().showWindow({
        componentName: 'LoudnessAdjust',
        title: $t('audio.loudnessAdjust.title'),
        size: { width: 480, height: 380 },
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
