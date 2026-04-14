/**
 * ニコニコ生放送のログ送信ユーティリティ
 */
import { transformUrl } from 'services/dev-hosts';

/**
 * 各ログ種別に対応する追加パラメータの型定義
 *
 * 新しいログ種別を追加する場合は、ログ集計側との合意が必要です。
 * ここにパラメータの型を定義してください。
 */
export type LogGifParams = {
  // カスタムキャスト利用ログ（追加パラメータなし）
  customcast: undefined;

  // HTTP連携利用ログ
  http_relation: {
    uuid: string;
    method: string;
    url: string;
  };

  // 自動文字起こし利用ログ
  transcription: {
    text: string;
  };

  // 自動文字起こし設定変更ログ
  transcription_setting: {
    commentEnabled: boolean;
  };
};

/**
 * log.gif エンドポイントに送信するログ種別
 *
 * LogGifParams から自動的に派生されます
 */
export type LogGifId = keyof LogGifParams;

/**
 * log.gif エンドポイントへログを送信する共通関数
 *
 * ログ種別に応じて、追加パラメータが必須かどうかが決定されます：
 * - customcast: 追加パラメータなし
 * - http_relation: uuid, method, url が必須
 *
 * @param id ログ種別
 * @param contentId 番組ID
 * @param args 追加パラメータ（ログ種別に応じて型が決定されます）
 */
export async function sendLogGif<T extends LogGifId>(
  id: T,
  contentId: string,
  ...args: LogGifParams[T] extends undefined ? [] : [LogGifParams[T]]
): Promise<void> {
  try {
    if (!contentId) return;

    const url = transformUrl('https://dcdn.cdn.nicovideo.jp/shared_httpd/log.gif');
    const params = new URLSearchParams();
    params.append('frontend_id', '134'); // N Air
    params.append('id', id);
    params.append('content_id', contentId);

    // 追加パラメータがあれば追加
    const additionalParams = args[0];
    if (additionalParams) {
      for (const [key, value] of Object.entries(additionalParams)) {
        params.append(key, value);
      }
    }

    await fetch(`${url}?${params}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    });
  } catch (e) {
    // エラーは無視する
  }
}
