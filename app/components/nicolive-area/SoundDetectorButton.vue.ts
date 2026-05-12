import { Component, Vue } from 'vue-property-decorator';
import { Inject } from 'services/core';
import { SettingsService } from 'services/settings';
import { SoundDetectorService, SoundDetectedState } from 'services/sound-detector';
import { Subscription } from 'rxjs';

@Component({})
export default class SoundDetectorButton extends Vue {
  @Inject() private settingsService: SettingsService;
  @Inject() private soundDetectorService: SoundDetectorService;

  // 音声検出状態
  soundDetected: SoundDetectedState = 'no-signal';

  // サブスクリプション
  private soundDetectSubscription: Subscription = null;

  // SoundDetectorが有効かどうか
  get isEnabled(): boolean {
    return this.soundDetectorService.isEnabled();
  }

  // アイコンクラスを返す
  get iconClass(): string {
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
  }

  // ツールチップテキストを返す
  get tooltip(): string {
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
  }

  // クリック時に設定画面を開く
  openSettings() {
    this.settingsService.showSoundDetectorSettings();
  }

  mounted() {
    // SoundDetectorの状態を購読
    this.soundDetectSubscription = this.soundDetectorService.soundDetectedObservable.subscribe({
      next: (detected) => {
        this.soundDetected = detected.soundDetected;
      },
    });
  }

  beforeDestroy() {
    if (this.soundDetectSubscription) {
      this.soundDetectSubscription.unsubscribe();
      this.soundDetectSubscription = null;
    }
  }
}
