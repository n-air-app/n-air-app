import { Subscription } from 'rxjs';
import { $t } from 'services/i18n';
import { ILoudness, LoudnessService, LoudnessStatus } from 'services/loudness';
import { WindowsService } from 'services/windows';
import { Menu } from 'util/menus/Menu';
import { defineComponent } from 'vue';

// 目標との差がこの範囲 (LU) なら「適正」とみなす
const TOLERANCE_LU = 3;

// 右クリックメニューで選べる目標値 (LUFS)
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
      const integrated = this.loudness?.integrated;
      return $t('audio.loudnessTooltip', {
        target: this.targetLufs,
        integrated: integrated === null || integrated === undefined ? '---' : integrated.toFixed(1),
      });
    },
  },

  methods: {
    reset() {
      LoudnessService.instance().reset();
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
          label: $t('audio.loudnessTargetItem', { target }),
          type: 'radio',
          checked: service.targetLufs === target,
          click: () => service.setTargetLufs(target),
        });
      });
      menu.append({ type: 'separator' });
      menu.append({
        id: 'Loudness reset',
        label: $t('audio.loudnessResetIntegrated'),
        click: () => service.reset(),
      });
      menu.popup();
    },
  },
});
