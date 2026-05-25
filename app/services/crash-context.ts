import * as remote from '@electron/remote';
import { ipcRenderer } from 'electron';
import { debounceTime, merge, Subject, Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { Service } from 'services/core/service';
import { InitAfter } from 'services/core/service-initialization-observer';
import { ScenesService } from 'services/scenes';
import { SettingsService } from 'services/settings';
import { SourcesService } from 'services/sources';
import { StreamingService } from 'services/streaming';
import { setObsOpObserver } from 'util/sentry-obs-breadcrumb';

const DEBOUNCE_MS = 300;

@InitAfter('ScenesService')
export class CrashContextService extends Service {
  @Inject() private scenesService: ScenesService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private streamingService: StreamingService;
  @Inject() private settingsService: SettingsService;

  private subscriptions: Subscription[] = [];
  private encoderUpdateTrigger = new Subject<void>();

  init() {
    setObsOpObserver((op) => this.setLastObsOp(op));

    this.subscriptions.push(
      this.scenesService.sceneSwitched.subscribe((scene) => {
        this.set('nair.scene', scene.name);
        this.updateSourcesList();
      }),
      merge(
        this.scenesService.sceneAdded,
        this.scenesService.sceneRemoved,
      ).subscribe(() => {
        this.set('nair.scenes.count', String(this.scenesService.scenes.length));
      }),
      merge(
        this.sourcesService.sourceAdded,
        this.sourcesService.sourceRemoved,
      ).pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => {
        this.updateSourcesList();
      }),
      this.streamingService.streamingStatusChange.subscribe((status) => {
        this.set('nair.streaming', status);
      }),
      this.encoderUpdateTrigger
        .pipe(debounceTime(DEBOUNCE_MS))
        .subscribe(() => {
          this.updateEncoderInfoImpl();
        }),
    );

    this.snapshotAll();
  }

  setLastUserOp(name: string) {
    this.set('nair.lastUserOp', name);
  }

  setLastObsOp(op: string) {
    this.set('nair.lastObsOp', op);
  }

  setAppPhase(phase: string) {
    this.set('nair.appPhase', phase);
  }

  triggerEncoderUpdate() {
    this.encoderUpdateTrigger.next();
  }

  private snapshotAll() {
    const activeScene = this.scenesService.activeScene;
    if (activeScene) {
      this.set('nair.scene', activeScene.name);
      this.updateSourcesList();
    }
    this.set('nair.scenes.count', String(this.scenesService.scenes.length));
    this.set('nair.streaming', this.streamingService.state.streamingStatus);
    this.updateEncoderInfoImpl();
  }

  private updateSourcesList() {
    const activeScene = this.scenesService.activeScene;
    if (!activeScene) return;
    const items = activeScene.getItems();
    const names = items.map((item) => {
      const source = this.sourcesService.getSource(item.sourceId);
      return source ? source.name : item.sourceId;
    });
    const total = names.length;
    const preview = names.slice(0, 3).join(',');
    this.set('nair.sources', total > 3 ? `${preview},...(${total})` : preview);
  }

  private updateEncoderInfoImpl() {
    try {
      const enc = this.settingsService.getStreamEncoderSettings();
      const videoStr = [
        enc.encoder,
        enc.outputResolution,
        enc.fps ? `${enc.fps}fps` : '',
        enc.bitrate ? `${enc.bitrate}kbps` : '',
      ].filter(Boolean).join(' ');
      const audioStr = [
        'aac',
        enc.audio.bitrate ? `${enc.audio.bitrate}kbps` : '',
      ].filter(Boolean).join(' ');
      this.set('nair.encoder.video', videoStr);
      this.set('nair.encoder.audio', audioStr);
    } catch {
      // Settings may not be ready at startup; silently skip
    }
  }

  private set(key: string, value: string) {
    try {
      remote.crashReporter.addExtraParameter(key, value);
    } catch {
      // Ignore errors if crashReporter is not available
    }
    ipcRenderer.send('crash-context-update', key, value);
  }
}
