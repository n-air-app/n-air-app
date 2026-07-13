import * as remote from '@electron/remote';
import { $t } from 'services/i18n';
import { SentryReport } from 'util/sentry-report';

import {
  FailedResult,
  FailureKind,
  isCertificateErrorCode,
  NotLoggedInError,
  RequestRoute,
} from './NicoliveClient';

export class NicoliveFailure {
  constructor(
    public type: 'logic' | 'http_error' | 'network_error',
    public method: string,
    public reason: string,
    public additionalMessage: string = '',
    public errorCode: string = '',
    /** API 呼び出し経路（診断用） */
    public route?: RequestRoute,
    /** API 呼び出し失敗の種別（診断用） */
    public failureKind?: FailureKind,
  ) {}

  static fromClientError(method: string, res: FailedResult) {
    const route = res.diag?.route;
    const failureKind = res.diag?.failureKind;

    if (res.value instanceof NotLoggedInError) {
      console.error(res.value);
      return new this('logic', method, 'not_logged_in', '', '', route, 'not_logged_in');
    }
    if (res.value instanceof Error) {
      console.error(res.value);
      const diagCode = res.diag?.errorCode;
      // TLS 証明書の検証失敗(ウイルス対策ソフト・社内プロキシの SSL 傍受、証明書期限切れ等)は
      // ユーザー環境要因であり「ネットワークエラー」とは原因が異なるため、reason を証明書用に切り替え、
      // errorCode に元コードを残してユーザー向けメッセージと診断で区別できるようにする
      if (isCertificateErrorCode(diagCode)) {
        return new this('network_error', method, 'certificate_error', '', diagCode, route, 'network_error');
      }
      // json_parse は Error だが network_error と区別して reason に残す
      const kind = failureKind ?? 'network_error';
      return new this('network_error', method, kind, '', diagCode ?? '', route, kind);
    }
    const { errorCode, errorMessage } = res.value.meta;
    const additionalMessage = `${errorCode ?? ''}${errorMessage ? `: ${errorMessage}` : ''}`;
    return new this(
      'http_error',
      method,
      res.value.meta.status.toString(10),
      additionalMessage,
      errorCode,
      route,
      failureKind,
    );
  }

  static fromConditionalError(method: string, reason: string) {
    return new this('logic', method, reason);
  }
}

async function openErrorDialog({
  title,
  message,
}: {
  title: string;
  message: string;
}): Promise<void> {
  return new Promise<void>((resolve) => {
    remote.dialog
      .showMessageBox(remote.getCurrentWindow(), {
        type: 'warning',
        title,
        message,
        buttons: ['Close'],
      })
      .then(() => resolve());
  });
}

function fallbackToX00(reason: string): string {
  const matched = reason.match(/^(\d)\d\d$/);
  if (matched) {
    return `${matched[1]}00`;
  }
  return reason;
}

export async function openErrorDialogFromFailure(failure: NicoliveFailure): Promise<void> {
  if (failure.type !== 'network_error') {
    SentryReport.message('NicoliveProgram', 'openErrorDialogFromFailure', 'openErrorDialogFromFailure', {
      level: 'warning',
      extra: { failure },
      tags: {
        'failure.type': failure.type,
        'failure.method': failure.method,
        'failure.reason': failure.reason,
      },
      fingerprint: ['openErrorDialogFromFailure'],
    });
  }

  if (failure.type === 'logic') {
    return openErrorDialog({
      title: $t(`nicolive-program.errors.logic.${failure.method}.${failure.reason}.title`),
      message: $t(`nicolive-program.errors.logic.${failure.method}.${failure.reason}.message`),
    });
  }

  // errorCode, status code(4xx, 5xx) -> status code(400, 500) の順で探索するfallback chain を構築する。
  // network_error 系(certificate_error など method 個別の文言を持たない reason)は
  // 最終的に共通の network_error 文言にフォールバックさせ、空ダイアログを防ぐ。
  const fallbackChain = [
    failure.errorCode ? failure.errorCode : undefined,
    failure.reason,
    fallbackToX00(failure.reason),
    failure.type === 'network_error' ? 'network_error' : undefined,
  ];
  const buildMessage = (
    key: string,
    params: { additionalMessage?: string } = {},
    index: number = 0,
  ): string | undefined => {
    if (index >= fallbackChain.length) {
      return undefined;
    }
    if (fallbackChain[index] === undefined) {
      return buildMessage(key, params, index + 1);
    }
    return $t(`nicolive-program.errors.api.${failure.method}.${fallbackChain[index]}.${key}`, {
      ...params,
      fallback: buildMessage(key, params, index + 1),
    });
  };
  return openErrorDialog({
    title: buildMessage('title') ?? '',
    message: buildMessage('message', { additionalMessage: failure.additionalMessage }) ?? '',
  });
}
