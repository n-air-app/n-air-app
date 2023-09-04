import { PersistentStatefulService } from 'services/core/persistent-stateful-service';
import { mutation } from '../core/stateful-service';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { $t } from 'services/i18n';
import { SourcesService } from 'services/sources';
import { Inject } from '../core/injector';
import * as obs from '../../../obs-api';

export const SynthesizerIds = ['webSpeech', 'nVoice'] as const;
export type SynthesizerId = (typeof SynthesizerIds)[number];
export const SynthesizerSelectors = [...SynthesizerIds, 'ignore'] as const;
export type SynthesizerSelector = (typeof SynthesizerSelectors)[number];

type SpeechSynthesizerSettingsState = {
  enabled: boolean;
  pitch: number;
  rate: number;
  volume: number;
  maxTime?: number;
  selector: {
    normal: SynthesizerSelector;
    operator: SynthesizerSelector;
    system: SynthesizerSelector;
  };
};

type NameplateHintState = {
  programID: string;
  commentNo: number;
};

interface IState {
  autoExtensionEnabled: boolean;
  panelOpened: boolean;
  speechSynthesizerSettings?: SpeechSynthesizerSettingsState;
  nameplateHint?: NameplateHintState;
  nameplateEnabled: boolean;
}

/**
 * ニコ生配信機能に関する永続化したい状態を管理するService
 */
export class NicoliveProgramStateService extends PersistentStatefulService<IState> {
  static defaultState: IState = {
    autoExtensionEnabled: false,
    panelOpened: true,
    nameplateEnabled: true,
  };

  @Inject() private sourcesService: SourcesService;

  private subject: Subject<IState> = new BehaviorSubject<IState>(this.state);
  updated: Observable<IState> = this.subject.asObservable();

  toggleAutoExtension(): void {
    this.setState({ autoExtensionEnabled: !this.state.autoExtensionEnabled });
  }

  togglePanelOpened(): void {
    this.setState({ panelOpened: !this.state.panelOpened });
  }

  updateSpeechSynthesizerSettings(newState: SpeechSynthesizerSettingsState): void {
    this.setState({ speechSynthesizerSettings: newState });
  }

  updateNameplateHint(newState?: NameplateHintState): void {
    this.setState({ nameplateHint: newState });
  }

  updateNameplateEnabled(newState?: boolean): void {
    this.setState({ nameplateEnabled: newState });
  }

  private setState(nextState: Partial<IState>): void {
    const newState = { ...this.state, ...nextState };
    this.SET_STATE(newState);
    this.subject.next(newState);
  }

  @mutation()
  private SET_STATE(nextState: IState): void {
    this.state = nextState;
  }

  adaptCommentAudio() {
    const enabled = this.state.speechSynthesizerSettings.enabled;

    const source = this.sourcesService.getSources().find(a => a.type === 'comment_audio');
    if (!enabled && source) {
      this.sourcesService.removeSource(source.sourceId);
    }
    if (enabled && !source) {
      this.sourcesService.createSource(
        'コメント音声',
        'comment_audio',
        {},
        { channel: 10, audioSettings: { monitoringType: obs.EMonitoringType.MonitoringAndOutput } },
      );
    }
  }
}
