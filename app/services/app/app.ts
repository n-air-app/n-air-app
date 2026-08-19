import * as remote from '@electron/remote';
import electron from 'electron';
import { Subscription } from 'rxjs';
import { IpcServerService } from 'services/api/ipc-server';
import { TcpServerService } from 'services/api/tcp-server';
import { Inject } from 'services/core/injector';
import { mutation, StatefulService } from 'services/core/stateful-service';
import { CrashReporterService } from 'services/crash-reporter';
import { CustomizationService } from 'services/customization';
import { FileManagerService } from 'services/file-manager';
import { HotkeysService } from 'services/hotkeys';
import { InformationsService } from 'services/informations';
import { NicoliveClient } from 'services/nicolive-program/NicoliveClient';
import { OnboardingService } from 'services/onboarding';
import { PatchNotesService } from 'services/patch-notes';
import { ProtocolLinksService } from 'services/protocol-links';
import { SceneCollectionsService } from 'services/scene-collections';
import { ScenesService } from 'services/scenes';
import { VideoSettingsService } from 'services/settings-v2';
import { ShortcutsService } from 'services/shortcuts';
import { SourcesService } from 'services/sources';
import { StreamingService } from 'services/streaming';
import { TranscriptionService } from 'services/transcription/transcription';
import { TransitionsService } from 'services/transitions';
import { UsageStatisticsService } from 'services/usage-statistics';
import { UserService } from 'services/user';
import Utils, { uuidv4 } from 'services/utils';
import { VideoService } from 'services/video';
import { WindowsService } from 'services/windows';
import { sleep } from 'util/sleep';

import * as obs from '../../../obs-api';

interface IAppState {
  loading: boolean;
  shuttingDown: boolean;
  argv: string[];
  errorAlert: boolean;
}

/**
 * Performs operations that happen once at startup and shutdown. This service
 * mainly calls into other services to do the heavy lifting.
 */
export class AppService extends StatefulService<IAppState> {
  @Inject() onboardingService: OnboardingService;
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() hotkeysService: HotkeysService;
  @Inject() userService: UserService;
  @Inject() shortcutsService: ShortcutsService;
  @Inject() patchNotesService: PatchNotesService;
  @Inject() windowsService: WindowsService;

  static initialState: IAppState = {
    loading: true,
    shuttingDown: false,
    argv: remote.process.argv,
    errorAlert: false,
  };

  readonly appDataDirectory = remote.app.getPath('userData');

  /** OBS init前にbasic.iniが存在していたか。falseの場合はOBSがデフォルト値で初期化している */
  obsConfigExisted = true;

  /** シャットダウン時にシーンコレクション等の保存をスキップするフラグ（全キャッシュ削除時に使用） */
  private skipSavingOnShutdown = false;

  @Inject() transitionsService: TransitionsService;
  @Inject() sourcesService: SourcesService;
  @Inject() scenesService: ScenesService;
  @Inject() videoService: VideoService;
  @Inject() videoSettingsService: VideoSettingsService;
  @Inject() private ipcServerService: IpcServerService;
  @Inject() private tcpServerService: TcpServerService;
  @Inject() private fileManagerService: FileManagerService;
  @Inject() private protocolLinksService: ProtocolLinksService;
  @Inject() private informationsService: InformationsService;
  @Inject() private crashReporterService: CrashReporterService;
  @Inject() private customizationService: CustomizationService;
  @Inject() private transcriptionService: TranscriptionService;
  @Inject() private streamingService: StreamingService;
  private loadingPromises: Dictionary<Promise<any>> = {};

  readonly pid = require('process').pid;

  async load() {
    UsageStatisticsService.instance().recordEvent({ event: 'boot' });
    return this.runInLoadingMode(async () => {
      if (Utils.isDevMode()) {
        electron.ipcRenderer.on('showErrorAlert', () => {
          this.SET_ERROR_ALERT(true);
        });
      }

      // We want to start this as early as possible so that any
      // exceptions raised while loading the configuration are
      // associated with the user in sentry.
      // await this.userService.initialize();
      await this.userService;

      // Second, we want to start the crash reporter service.  We do this
      // after the user service because we want crashes to be associated
      // with a particular user if possible.
      this.crashReporterService.beginStartup();

      // Initialize any apps before loading the scene collection.  This allows
      // the apps to already be in place when their sources are created.
      // await this.platformAppsService.initialize();

      // パッチノートはOBS/シーンに依存しないため、シーン初期化前に表示判定する
      const willOnboard = this.onboardingService.willOnboardOnStartup();
      this.patchNotesService.showPatchNotesIfRequired(willOnboard);

      await this.sceneCollectionsService.initialize();

      this.startMonitoringStudioMode();
      this.onboardingService.startOnboardingIfRequired();

      electron.ipcRenderer.on('shutdown', () => {
        electron.ipcRenderer.send('acknowledgeShutdown');
        this.shutdownHandler();
      });

      // Eager load services
      const _ = [this.shortcutsService];

      this.ipcServerService.listen();
      this.tcpServerService.listen();

      this.informationsService;

      this.transcriptionService;

      this.crashReporterService.endStartup();

      this.protocolLinksService.start(this.state.argv);
    });
  }

  private shutdownHandler() {
    UsageStatisticsService.instance().recordEvent({ event: 'app_close' });
    // SLOBS の shutdownHandlerでの順序に従います
    // https://github.com/stream-labs/desktop/blob/05edf2206a3c10c13b60ede8ddd5e776509ebd5f/app/services/app/app.ts#L178
    console.log('[SHUTDOWN] Starting shutdown sequence');
    this.START_LOADING();
    this.tcpServerService.stopListening();

    window.setTimeout(async () => {
      try {
        // InitShutdownSequence をスキップ (N Air はクラッシュハンドラープロセスを使用していないため)
        // Streamlabs Desktop では別プロセスとしてクラッシュハンドラーを起動し、named pipe で通信しているが、
        // N Air にはその実装がないため、InitShutdownSequence は5秒タイムアウトするだけ。
        // IPC.disconnect() でクリーンアップされるため、明示的な呼び出しは不要。
        // 参考: https://github.com/streamlabs/obs-studio-node/blob/main/obs-studio-server/source/nodeobs_api.cpp#L1539-L1559
        // obs.NodeObs.InitShutdownSequence();

        this.crashReporterService.beginShutdown();
        this.START_SHUTDOWN();

        this.transcriptionService.shutdown();

        if (this.windowsService.isChildWindowShown()) {
          await this.windowsService.closeChildWindow();
        }

        await this.windowsService.closeAllOneOffs();
        NicoliveClient.closeOpenWindows();
        this.ipcServerService.stopListening();
        this.stopMonitoringStudioMode();
        await this.sceneCollectionsService.deinitialize({
          // 全キャッシュ削除時はシーンコレクションを保存しない（再起動後に削除されるため）
          saveOnExit: !this.skipSavingOnShutdown,
        });
        this.transitionsService.shutdown();
        this.videoSettingsService.shutdown();
        if (!this.skipSavingOnShutdown) {
          await this.fileManagerService.flushAll();
        }
        try {
          await Promise.race([
            this.streamingService.logStreamEnd(),
            new Promise<void>((resolve) => { setTimeout(resolve, 5000); }),
          ]);
        } catch (e) {
          console.error('[SHUTDOWN] Error sending stream_end log:', e);
        }
        obs.NodeObs.RemoveSourceCallback();
        obs.NodeObs.OBS_service_removeCallback();
        obs.IPC.disconnect();
        this.crashReporterService.endShutdown();
        console.log('[SHUTDOWN] Shutdown sequence completed');
      } catch (e) {
        console.error('[SHUTDOWN] Error during shutdown:', e);
      } finally {
        electron.ipcRenderer.send('shutdownComplete');
      }
    }, 300);
  }

  private studioModeSubscription: Subscription | null;
  /**
   * Customization Settingsの永続設定から Studio Modeを設定し、以後 Studio Mode の変化を監視して永続化する
   *
   * @note (シーン初期化中に強制解除されてしまうため)シーン初期化後に実行すること。
   * また、startOnboardingIfRequired()の中からcompletedが発火することがあるため、その前に実行すること
   */
  startMonitoringStudioMode() {
    this.onboardingService.completed.subscribe(() => {
      if (this.customizationService.getStudioMode()) {
        this.transitionsService.enableStudioMode();
      }
      this.studioModeSubscription = this.transitionsService.studioModeChanged.subscribe(
        (isStudioMode) => {
          this.customizationService.setStudioMode(isStudioMode);
        },
      );
    });
  }
  /**
   * スタジオモード監視を終了する
   *
   * @note シーンクリーンアップ時にスタジオモードが強制解除されてしまうため、その前に実行すること
   */
  stopMonitoringStudioMode() {
    if (this.studioModeSubscription) {
      this.studioModeSubscription.unsubscribe();
      this.studioModeSubscription = null;
    }
  }

  /**
   * Show loading, block the nav-buttons and disable autosaving
   * If called several times - unlock the screen only after the last function/promise has been finished
   * Should be called for any scene-collections loading operations
   */
  async runInLoadingMode(fn: () => Promise<any> | void) {
    if (!this.state.loading) {
      //this.windowsService.updateStyleBlockers('main', true);
      this.START_LOADING();

      // The scene collections window is the only one we don't close when
      // switching scene collections, because it results in poor UX.
      if (this.windowsService.state.child.componentName !== 'ManageSceneCollections') {
        this.windowsService.closeChildWindow();
      }

      // wait until all one-offs windows like Projectors will be closed
      await this.windowsService.closeAllOneOffs();

      // This is kind of ugly, but it gives the browser time to paint before
      // we do long blocking operations with OBS.
      await sleep(200);

      //TODO await this.sceneCollectionsService.disableAutoSave();
    }

    let error: Error | null = null;
    let result: any = null;

    try {
      result = fn();
    } catch (e) {
      error = null;
    }

    let returningValue = result;
    if (result instanceof Promise) {
      const promiseId = uuidv4();
      this.loadingPromises[promiseId] = result;
      try {
        returningValue = await result;
      } catch (e) {
        error = e as Error;
      }
      delete this.loadingPromises[promiseId];
    }

    if (Object.keys(this.loadingPromises).length > 0) {
      // some loading operations are still in progress
      // don't stop the loading mode
      if (error) throw error;
      return returningValue;
    }

    this.tcpServerService.startRequestsHandling();
    //TODO this.sceneCollectionsService.enableAutoSave();
    this.FINISH_LOADING();
    // Set timeout to allow transition animation to play
    //TODO setTimeout(() => this.windowsService.updateStyleBlockers('main', false), 500);
    if (error) throw error;
    return returningValue;
  }

  relaunch({ clearCacheDir }: { clearCacheDir?: 'all' | 'cache' | 'cookie' } = {}) {
    const originalArgs: string[] = remote.process.argv.slice(1);

    const args = originalArgs.filter(
      (x) => !['--clearCacheDir', '--clearCookies', '--includeSceneCollections'].includes(x),
    );
    // キャッシュクリアしたいときだけつくようにする
    switch (clearCacheDir) {
      case 'cookie':
        args.push('--clearCookies');
        break;
      case 'cache':
        // シーンコレクションを保持してキャッシュを削除
        args.push('--clearCacheDir');
        break;
      case 'all':
        // シーンコレクションを含むすべてを削除
        args.push('--clearCacheDir');
        args.push('--includeSceneCollections');
        this.skipSavingOnShutdown = true;
        break;
    }

    remote.app.relaunch({ args });
    remote.app.quit();
  }

  startLoading() {
    this.START_LOADING();
  }

  finishLoading() {
    this.FINISH_LOADING();
  }

  @mutation()
  private START_LOADING() {
    this.state.loading = true;
  }

  @mutation()
  private FINISH_LOADING() {
    this.state.loading = false;
  }

  @mutation()
  private START_SHUTDOWN() {
    this.state.shuttingDown = true;
  }

  @mutation()
  private SET_ERROR_ALERT(errorAlert: boolean) {
    this.state.errorAlert = errorAlert;
  }

  @mutation()
  private SET_ARGV(argv: string[]) {
    this.state.argv = argv;
  }
}
