import { InitAfter, Inject } from './core';
import { mutation, StatefulService } from './core/stateful-service';
import { sendLogGif } from './nicolive-program/nicolive-logger';
import { NicoliveProgramService } from './nicolive-program/nicolive-program';
import { ScenesService } from './scenes';
import { SourcesService } from './sources';

export interface ICustomcastUsageState {
  isCustomcastUsed: boolean;
  programID: string;
}

InitAfter('ScenesService');
export class CustomcastUsageService extends StatefulService<ICustomcastUsageState> {
  static initialState: ICustomcastUsageState = {
    isCustomcastUsed: false,
    programID: '',
  };

  @Inject() private scenesService: ScenesService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private nicoliveProgramService: NicoliveProgramService;

  init() {
    super.init();
    this.reset();

    this.scenesService.sceneSwitched.subscribe(() => {
      if (this.containsCustomcastInActiveScene()) {
        this.markCustomcastUsed();
      }
    });

    this.scenesService.itemAdded.subscribe((item) => {
      if (this.isCustomcastSourceId(item.sourceId)) {
        this.markCustomcastUsed();
      }
    });
  }

  isCustomcastSourceId(sourceId: string): boolean {
    const sourceDetails = this.sourcesService.getSource(sourceId).getComparisonDetails();
    return sourceDetails.propertiesManager === 'custom-cast-ndi';
  }

  containsCustomcastInActiveScene(): boolean {
    // 配信開始直後やシーンコレクション切替中などはactiveSceneが一時的にnullになりうる。
    // その場合は使用なしとして扱う(実害が軽微なためSentry報告はしない)。
    const activeScene = this.scenesService.activeScene;
    if (!activeScene) return false;

    for (const item of activeScene.getItems()) {
      if (this.isCustomcastSourceId(item.sourceId)) {
        return true;
      }
    }
    return false;
  }

  startStreaming() {
    this.reset();
    if (this.containsCustomcastInActiveScene()) {
      this.markCustomcastUsed();
    }
  }

  stopStreaming() {
    if (this.state.isCustomcastUsed && this.state.programID !== '') {
      sendLogGif('customcast', this.state.programID);
    }
  }

  private reset() {
    this.SET_IS_CUSTOMCAST_USED(false);
    this.SET_PROGRAM_ID('');
  }

  private markCustomcastUsed() {
    this.SET_IS_CUSTOMCAST_USED(true);
    this.SET_PROGRAM_ID(this.nicoliveProgramService.state.programID);
  }

  @mutation()
  private SET_IS_CUSTOMCAST_USED(isCustomcastUsed: boolean) {
    this.state.isCustomcastUsed = isCustomcastUsed;
  }

  @mutation()
  private SET_PROGRAM_ID(programID: string) {
    this.state.programID = programID;
  }
}
