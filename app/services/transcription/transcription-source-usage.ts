import { mutation, StatefulService } from 'services/core';
import { Inject } from 'services/core/injector';
import { ScenesService } from 'services/scenes';
import { SourcesService } from 'services/sources';

interface ITranscriptionSourceUsageState {
  used: boolean;
}

export class TranscriptionSourceUsageService extends StatefulService<ITranscriptionSourceUsageState> {
  @Inject() sourcesService: SourcesService;
  @Inject() scenesService: ScenesService;

  static initialState: ITranscriptionSourceUsageState = {
    used: false,
  };

  init() {
    this.reset();

    this.scenesService.sceneSwitched.subscribe(() => {
      if (this.containsTranscriptionInActiveScene()) {
        this.markTranscriptionUsed();
      }
    });

    this.scenesService.itemAdded.subscribe(item => {
      if (this.isTranscriptionSourceId(item.sourceId)) {
        this.markTranscriptionUsed();
      }
    });
  }

  markTranscriptionUsed() {
    if (!this.state.used) {
      this.setState({ used: true });
    }
  }

  reset() {
    this.setState({ used: false });
  }

  isTranscriptionSourceId(sourceId: string): boolean {
    const sourceDetails = this.sourcesService.getSource(sourceId).getComparisonDetails();
    return sourceDetails.propertiesManager === 'text_transcription';
  }

  containsTranscriptionInActiveScene(): boolean {
    for (const item of this.scenesService.activeScene.getItems()) {
      if (this.isTranscriptionSourceId(item.sourceId)) {
        return true;
      }
    }
    return false;
  }

  startStreaming() {
    this.reset();
    if (this.containsTranscriptionInActiveScene()) {
      this.markTranscriptionUsed();
    }
  }

  stopStreaming() {
    // do nothing
  }

  setState(state: Partial<ITranscriptionSourceUsageState>) {
    this.setState({ ...this.state, ...state });
  }

  @mutation()
  SET_STATE(state: ITranscriptionSourceUsageState) {
    this.state = state;
  }
}
