// 自動調整でソースの音量を測る時間 (ms)。測定処理と進捗表示で共有する
export const MEASURE_DURATION_MS = 8000;

// 自動調整でフェーダーを下げる下限 (dB)。これ以上は無音に近く、調整対象として不適切
export const FADER_MIN_DB = -60;

// これ以上ゲインで持ち上げるとノイズが目立つ。超える分は OS の入力音量での調整を案内する
export const GAIN_FILTER_RECOMMENDED_MAX_DB = 20;

// ゲインフィルタ (gain_filter) の設定範囲の下限 (dB)。これより下げる分はフェーダーで補う
export const GAIN_FILTER_MIN_DB = -30;

export interface IAdjustInput {
  /** 測定したソース単体のラウドネス (LUFS、pre-fader) */
  measuredLufs: number;
  /** 目標 (LUFS) */
  targetLufs: number;
  /** 現在のフェーダー (dB、0 以下) */
  faderDb: number;
  /** 既存のゲインフィルタの値 (dB)。なければ null */
  currentGainDb: number | null;
}

export interface IAdjustPlan {
  /** 適用後のフェーダー (dB、0 以下) */
  faderDb: number;
  /** 適用後のゲインフィルタの値 (dB)。ゲインフィルタが不要で、まだ無ければ null */
  gainDb: number | null;
  /** 推奨上限を超えたため、ゲインを頭打ちにした (OS の入力音量を案内する) */
  limited: boolean;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * 測定値を目標に合わせるための、フェーダーとゲインフィルタの値を求める。
 * pre-fader の測定値はフェーダーを含まないが、ゲインフィルタ (フィルタ適用後) は含む。
 *
 * 配分の方針:
 * - 大きすぎる: ゲインフィルタがあればゲインを下げる (負の値も可)。下限を超える分だけフェーダーで補う。
 *   ゲインフィルタが無ければ作らず、フェーダーだけで下げる
 * - 小さすぎる: フェーダーを 0 dB まで戻し、足りない分をゲインフィルタで足す
 */
export function planAdjustment(input: IAdjustInput): IAdjustPlan {
  const { measuredLufs, targetLufs, faderDb, currentGainDb } = input;
  const gain = currentGainDb ?? 0;

  // 全体として必要な変化量 (dB)。フェーダー込みで目標に合わせる
  const needed = targetLufs - (measuredLufs + faderDb);
  // 合計 (ゲイン + フェーダー) の目標値
  const totalDb = gain + faderDb + needed;

  if (totalDb > 0) {
    const limited = totalDb > GAIN_FILTER_RECOMMENDED_MAX_DB;
    const gainDb = round1(Math.min(totalDb, GAIN_FILTER_RECOMMENDED_MAX_DB));
    return { faderDb: 0, gainDb, limited };
  }

  if (currentGainDb === null) {
    // ゲインフィルタが無ければ作らず、フェーダーだけで下げる
    return { faderDb: Math.max(round1(totalDb), FADER_MIN_DB), gainDb: null, limited: false };
  }

  // ゲインフィルタがあれば、ゲインを優先して下げる。下限を超える分だけフェーダーで補う
  const gainDb = Math.max(round1(totalDb), GAIN_FILTER_MIN_DB);
  const rest = round1(totalDb - gainDb);
  return { faderDb: Math.max(rest, FADER_MIN_DB), gainDb, limited: false };
}

// これ以下の momentary は完全な無音とみなして除く
export const ABSOLUTE_SILENCE_LUFS = -70;

// 声があるとみなすのに必要な、測定中の音量の振れ幅 (LU)。
// ノイズだけならほぼ一定で、声は単語の間で上下するため、これ未満は声なしとみなす
export const VOICE_MIN_SPREAD_LU = 6;

const percentile = (sorted: number[], p: number) => sorted[Math.floor(p * (sorted.length - 1))];

/**
 * 測定中に集めた momentary (LUFS) から、声の大きさを求める。
 * 下位 10% を床 (ノイズ)、上位 90% を山として、振れ幅が足りなければ声なし (null)。
 * 声ありなら、床と山の中間より大きいサンプルの中央値を返す
 */
export function pickVoiceLevel(samples: number[], minVoiceSamples: number): number | null {
  const audible = samples.filter((value) => value > ABSOLUTE_SILENCE_LUFS);
  if (!audible.length) return null;

  const sorted = [...audible].sort((a, b) => a - b);
  const floor = percentile(sorted, 0.1);
  const peak = percentile(sorted, 0.9);
  if (peak - floor < VOICE_MIN_SPREAD_LU) return null;

  const voice = audible.filter((value) => value >= (floor + peak) / 2);
  return voice.length >= minVoiceSamples ? median(voice) : null;
}

/** 測定値のばらつきを抑えるための中央値。空なら null */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
