import { InitAfter, Inject } from './core';
import { Service } from './core/service';
import { NVoiceAvatarStyle } from './nvoice-character';
import { ScenesService } from './scenes';
import { SourcesService } from './sources';

export type NVoiceCharacterUsageLog = {
  used: boolean;
  standing1: boolean;
  standing2: boolean;
};

@InitAfter('ScenesService')
export class NVoiceCharacterUsageService extends Service {
  @Inject() private scenesService: ScenesService;
  @Inject() private sourcesService: SourcesService;

  private usedStyles = new Set<NVoiceAvatarStyle>();

  init() {
    this.scenesService.sceneSwitched.subscribe(() => {
      for (const style of this.collectNVoiceAvatarStylesInActiveScene()) {
        this.usedStyles.add(style);
      }
    });

    this.scenesService.itemAdded.subscribe(item => {
      const source = this.sourcesService.getSource(item.sourceId);
      if (!source) return;
      if (source.getPropertiesManagerType() !== 'nvoice-character') return;
      const style: NVoiceAvatarStyle =
        source.getPropertiesManagerSettings().nVoiceAvatarStyle || 'standing1';
      this.usedStyles.add(style);
    });
  }

  private collectNVoiceAvatarStylesInActiveScene(): NVoiceAvatarStyle[] {
    const styles: NVoiceAvatarStyle[] = [];
    for (const item of this.scenesService.activeScene.getItems()) {
      const source = this.sourcesService.getSource(item.sourceId);
      if (!source) continue;
      if (source.getPropertiesManagerType() !== 'nvoice-character') continue;
      styles.push(source.getPropertiesManagerSettings().nVoiceAvatarStyle || 'standing1');
    }
    return styles;
  }

  startStreaming() {
    this.usedStyles = new Set(this.collectNVoiceAvatarStylesInActiveScene());
  }

  getActionLog(): NVoiceCharacterUsageLog {
    return {
      used: this.usedStyles.size > 0,
      standing1: this.usedStyles.has('standing1'),
      standing2: this.usedStyles.has('standing2'),
    };
  }
}
