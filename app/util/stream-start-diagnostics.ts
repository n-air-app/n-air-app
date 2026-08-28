import * as Sentry from '@sentry/vue';

// 配信開始要求(OBS_service_startStreaming)を呼んだにもかかわらず、
// OBS からの出力シグナルが一度も来ないまま配信開始前の状態に戻ってしまう問題の診断用モジュール。
//
// この失敗はダイアログも Sentry イベントも一切発生しない「完全な沈黙」になるため、
// 発生した事実そのものと、その後どう変更したら配信できるようになったのかを
// localStorage に永続化して回収する。N Air の再起動を挟んでユーザーが設定を変えるケースを
// 想定しているため、StatefulService の Vuex 経由の状態ではなく localStorage に直接持つ
// (cf. app/services/onboarding.ts のような小さな値の永続化)。

const STORAGE_KEY = 'StreamStartNoSignalDiagnostics';

// Sentry の tag 値は 200 文字までしか保持されないため、集計用の文字列はここで切る。
const TAG_VALUE_MAX_LENGTH = 200;

export type TSnapshotValue = string | number | boolean | null | undefined;

export interface IStreamSettingsSnapshot {
  [key: string]: TSnapshotValue | IStreamSettingsSnapshot;
}

export interface IStreamStartFailureRecord {
  /** 最初にこの症状が発生した時刻 (epoch ms) */
  firstAt: number;
  /** 直近にこの症状が発生した時刻 (epoch ms) */
  lastAt: number;
  /** この症状が発生した回数 */
  attempts: number;
  /** 直近の失敗時点での配信設定のスナップショット。取得自体に失敗した場合は null */
  settings: IStreamSettingsSnapshot | null;
}

// noteSettingsChangeWhileFailing の連続呼び出し抑制用。
// 設定画面は値を変更するたびに即座に保存するため、抑制しないと breadcrumb が large になる。
let lastNotedCategory: string | null = null;

function readRecord(): IStreamStartFailureRecord | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== 'object'
      || parsed === null
      || typeof parsed.firstAt !== 'number'
      || typeof parsed.lastAt !== 'number'
      || typeof parsed.attempts !== 'number'
    ) {
      return null;
    }
    return parsed as IStreamStartFailureRecord;
  } catch {
    // 壊れた値は診断機能自体を壊さないよう黙って捨てる
    return null;
  }
}

function writeRecord(record: IStreamStartFailureRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function getStreamStartFailure(): IStreamStartFailureRecord | null {
  return readRecord();
}

export function isStreamStartFailureActive(): boolean {
  return readRecord() !== null;
}

/**
 * 配信開始要求からシグナルが一度も来なかったことを記録する。
 * 既に記録がある場合は attempts を積み、firstAt は保持したまま settings を最新に更新する
 * (「成功する直前に失敗が確定していた設定」が差分のベースラインとして正しいため)。
 */
export function recordStreamStartFailure(settings: IStreamSettingsSnapshot | null): void {
  const now = Date.now();
  const existing = readRecord();
  writeRecord({
    firstAt: existing?.firstAt ?? now,
    lastAt: now,
    attempts: (existing?.attempts ?? 0) + 1,
    settings,
  });
}

export function clearStreamStartFailure(): void {
  localStorage.removeItem(STORAGE_KEY);
  lastNotedCategory = null;
}

/**
 * 失敗記録が残っている間だけ、設定変更を breadcrumb として記録する。
 * 同一カテゴリの連続呼び出しは抑制する(設定画面は値変更ごとに即保存されるため)。
 */
export function noteSettingsChangeWhileFailing(category: string): void {
  if (!isStreamStartFailureActive()) return;
  if (lastNotedCategory === category) return;
  lastNotedCategory = category;

  Sentry.addBreadcrumb({
    category: 'settings.change',
    message: category,
    level: 'info',
  });
}

function isPlainObject(value: unknown): value is IStreamSettingsSnapshot {
  return typeof value === 'object' && value !== null;
}

/**
 * 2つのスナップショットを比較し、値が変わったキーをドット区切りで平坦化して返す。
 * Sentry の tag に載せることで「どの設定を変えると配信できるようになるのか」を
 * ユーザーを跨いで集計できるようにするための文字列。
 *
 * どちらかが null (スナップショット取得自体に失敗した) なら比較不能として 'unknown' を返す。
 * 差分が無ければ 'none' を返す(設定を変えていないのに直った、という情報自体が有用)。
 */
export function summarizeChangedKeys(
  before: IStreamSettingsSnapshot | null | undefined,
  after: IStreamSettingsSnapshot | null | undefined,
): string {
  if (before == null || after == null) return 'unknown';

  const changed: string[] = [];

  const collect = (a: IStreamSettingsSnapshot, b: IStreamSettingsSnapshot, prefix: string) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((key) => {
      const path = prefix ? `${prefix}.${key}` : key;
      const av = a[key];
      const bv = b[key];
      const aIsObj = isPlainObject(av);
      const bIsObj = isPlainObject(bv);
      if (aIsObj || bIsObj) {
        collect(aIsObj ? av : {}, bIsObj ? bv : {}, path);
      } else if (av !== bv) {
        changed.push(path);
      }
    });
  };
  collect(before, after, '');

  if (changed.length === 0) return 'none';

  const summary = changed.sort().join(',');
  return summary.length > TAG_VALUE_MAX_LENGTH ? summary.slice(0, TAG_VALUE_MAX_LENGTH) : summary;
}

/** テスト用: モジュール内部状態(連続通知抑制用のキャッシュ)をリセットする */
export function resetForTest(): void {
  lastNotedCategory = null;
}
