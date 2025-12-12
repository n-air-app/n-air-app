import { BehaviorSubject, merge } from 'rxjs';
import { mutation, StatefulService } from 'services/core';
import { Inject } from 'services/core/injector';
import { ScenesService } from 'services/scenes';
import { TranscriptionSourceService } from './transcription-source';

interface ITranscriptionSourceUsageState {
  existsInActiveScene: boolean;
}

export class TranscriptionSourceUsageService extends StatefulService<ITranscriptionSourceUsageState> {
  @Inject() private scenesService: ScenesService;
  @Inject() private transcriptionSourceService: TranscriptionSourceService;

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
    if (this.transcriptionSourceService.containsTranscriptionInActiveScene()) {
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

  startStreaming() {
    this.reset();
    if (this.transcriptionSourceService.containsTranscriptionInActiveScene()) {
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
