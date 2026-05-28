import { Subscription } from 'rxjs';
import { SettingsService } from 'services/settings';
import { SoundDetectedState, SoundDetectorService } from 'services/sound-detector';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SoundDetectorButton',

  data() {
    return {
      // 音声検出状態
      soundDetected: 'no-signal' as SoundDetectedState,
      // サブスクリプション
      soundDetectSubscription: null as Subscription | null,
    };
  },

  computed: {
    // SoundDetectorが有効かどうか
    isEnabled(): boolean {
      return SoundDetectorService.instance.isEnabled();
    },

    // アイコンクラスを返す
    iconClass(): string {
      if (!this.isEnabled) {
        return 'icon-mute';
      }

      switch (this.soundDetected) {
        case 'loud':
          // TODO: 仮アイコン。専用の一時停止アイコンに差し替え予定
          return 'icon-replay-buffer-stop';
        case 'silence':
          return 'icon-sound-border';
        case 'no-signal':
          return 'icon-mute';
        default:
          return 'icon-mute';
      }
    },

    // ツールチップテキストを返す
    tooltip(): string {
      let status: string;

      if (!this.isEnabled) {
        status = '無効';
      } else {
        switch (this.soundDetected) {
          case 'loud':
            status = 'しゃべっています';
            break;
          case 'silence':
            status = '静か';
            break;
          case 'no-signal':
          default:
            status = '無音';
            break;
        }
      }

      return `音声検出: ${status} (クリックして設定)`;
    },
  },

  mounted() {
    // SoundDetectorの状態を購読
    this.soundDetectSubscription = SoundDetectorService.instance.soundDetectedObservable.subscribe({
      next: (detected: any) => {
        this.soundDetected = detected.soundDetected;
      },
    });
  },

  beforeUnmount() {
    if (this.soundDetectSubscription) {
      this.soundDetectSubscription.unsubscribe();
      this.soundDetectSubscription = null;
    }
  },

  methods: {
    // クリック時に設定画面を開く
    openSettings() {
      SettingsService.instance.showSoundDetectorSettings();
    },
  },
});
