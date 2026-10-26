// 自動調整でフェーダーを下げる下限 (dB)。これ以上は無音に近く、調整対象として不適切
export const FADER_MIN_DB = -60;

// これ以上ゲインで持ち上げるとノイズが目立つ。超える分は OS の入力音量での調整を案内する
export const GAIN_FILTER_RECOMMENDED_MAX_DB = 20;

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
 * - 大きすぎる: フィルタ → フェーダーの順に下げる (ゲインを足さない)
 * - 小さすぎる: フェーダーを 0 dB まで戻し、足りない分をゲインフィルタで足す
 */
export function planAdjustment(input: IAdjustInput): IAdjustPlan {
  const { measuredLufs, targetLufs, faderDb, currentGainDb } = input;
  const gain = currentGainDb ?? 0;

  // 全体として必要な変化量 (dB)。フェーダー込みで目標に合わせる
  const needed = targetLufs - (measuredLufs + faderDb);
  // 合計 (ゲイン + フェーダー) の目標値
  const totalDb = gain + faderDb + needed;

  if (totalDb <= 0) {
    // ゲインは不要。既存のゲインは 0 に戻し、フェーダーだけで合わせる
    return {
      faderDb: Math.max(round1(totalDb), FADER_MIN_DB),
      gainDb: currentGainDb === null ? null : 0,
      limited: false,
    };
  }

  const limited = totalDb > GAIN_FILTER_RECOMMENDED_MAX_DB;
  const gainDb = round1(Math.min(totalDb, GAIN_FILTER_RECOMMENDED_MAX_DB));
  return { faderDb: 0, gainDb, limited };
}

/** 測定値のばらつきを抑えるための中央値。空なら null */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
