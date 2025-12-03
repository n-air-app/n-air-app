import { BehaviorSubject, merge } from 'rxjs';
import { mutation, StatefulService } from 'services/core';
import { Inject } from 'services/core/injector';
import { ScenesService } from 'services/scenes';
import { SourcesService } from 'services/sources';

interface ITranscriptionSourceUsageState {
  existsInActiveScene: boolean;
}

export class TranscriptionSourceUsageService extends StatefulService<ITranscriptionSourceUsageState> {
  @Inject() private sourcesService: SourcesService;
  @Inject() private scenesService: ScenesService;

  static initialState: ITranscriptionSourceUsageState = {
    existsInActiveScene: false,
  };

  state$ = new BehaviorSubject<ITranscriptionSourceUsageState>(this.state);

  init() {
    super.init();

    this.updateTranscriptionUsage();

    merge(
      this.scenesService.sceneSwitched,
      this.scenesService.itemAdded,
      this.scenesService.itemRemoved,
    ).subscribe(() => {
      this.updateTranscriptionUsage();
    });
  }

  updateTranscriptionUsage() {
    if (this.containsTranscriptionInActiveScene()) {
      this.markTranscriptionUsed();
    } else {
      this.reset();
    }
  }

  markTranscriptionUsed() {
    if (!this.state.existsInActiveScene) {
      this.setState({ existsInActiveScene: true });
    }
  }

  reset() {
    this.setState({ existsInActiveScene: false });
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
    this.SET_STATE({ ...this.state, ...state });
    this.state$.next(this.state);
  }

  @mutation()
  SET_STATE(state: ITranscriptionSourceUsageState) {
    this.state = state;
  }
}
