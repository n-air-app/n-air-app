import * as remote from '@electron/remote';
import { Subject } from 'rxjs';
import { AppService } from 'services/app';
import { Inject } from 'services/core/injector';
import { Service } from 'services/core/service';
import { $t } from 'services/i18n';
import { WindowsService } from 'services/windows';
import { getLastObsOp } from 'util/sentry-obs-breadcrumb';
import { SentryReport } from 'util/sentry-report';

/**
 * obs-studio-node の独自ネイティブ IPC（obs64.exe との通信）が切断されたことを
 * アプリ全体で1度だけ検知・通知するサービス。
 *
 * 切断は obs64.exe(libobs) 側のクラッシュに起因し、obs-studio-node に再接続APIが
 * 存在しないため復旧できない（n-air-app#1380）。したがってできることは
 * 「早く検知してユーザーに再起動を促す」ことのみ。
 *
 * 注意: plain Service なので isLost を子ウィンドウから参照してはいけない
 * （internal-api-client のプロキシは非関数プロパティを転送しないため、
 *  子ウィンドウのローカルインスタンスの値=false が返る）。
 */
export class ObsIpcHealthService extends Service {
  @Inject() private appService: AppService;
  @Inject() private windowsService: WindowsService;

  /** IPC 切断が検知されたときに1度だけ発火する。引数は検知元の識別子 */
  private readonly ipcLostSubject = new Subject<string>();

  readonly ipcLost = this.ipcLostSubject.asObservable();
  private lost = false;

  get isLost(): boolean {
    return this.lost;
  }

  /**
   * IPC 切断を通知する。2回目以降の呼び出しは何もしない（2秒ポーリングからの再入対策）。
   * @param source 検知元（例: 'PerformanceService.getState'）
   */
  notifyIpcLost(source: string): void {
    if (this.lost) return;
    this.lost = true; // await より前に同期で立てる

    SentryReport.message('ObsIpcHealthService', 'notifyIpcLost', 'obs backend ipc lost', {
      level: 'warning',
      // app.ts の beforeSend が /Failed to make IPC call/ を NOISE として捨てるため、
      // 意図的に送るこのイベントには diagnostic タグが必須 (app.ts の beforeSend 参照)
      tags: { diagnostic: 'obs-ipc-lost', 'ipc.detectedBy': source },
      fingerprint: ['ObsIpcHealthService', 'obsBackendIpcLost'],
      extra: { source, lastObsOp: getLastObsOp() },
    });

    this.ipcLostSubject.next(source);

    this.offerRestart().catch(() => {});
  }

  private async offerRestart(): Promise<void> {
    const { window: parent } = this.windowsService.getDialogParent();
    const options: Electron.MessageBoxOptions = {
      type: 'error',
      buttons: [$t('common.yes'), $t('common.no')],
      title: $t('common.confirm'),
      message: $t('settings.noticeIpcError'),
      detail: $t('settings.noticeIpcErrorDetail'),
      noLink: true,
      cancelId: 1,
      defaultId: 0,
    };
    const choice = parent
      ? await remote.dialog.showMessageBox(parent, options)
      : await remote.dialog.showMessageBox(options);
    if (choice.response === 0) {
      this.appService.relaunch();
    }
    // 「いいえ」の場合も lost は解除しない: 再接続手段が無いため
    // ポーリング再開も再通知もしない（n-air-app#1380）
  }
}
