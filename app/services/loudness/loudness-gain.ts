// ゲイン (ゲインフィルタ) の段階 (dB)。「+」「-」を押すたびに隣の段階へ動かす。一度に大きく変えすぎないよう刻みを小さくしている。
// 上限はノイズが目立ち始める +20 dB。それ以上は OS の入力音量での調整を案内する
export const GAIN_STEPS_DB = [-18, -12, -6, 0, 6, 12, 20];

// 浮動小数点の誤差で同じ段階を飛ばさないための許容幅 (dB)
const EPSILON_DB = 0.01;

// ソースが音を出しているとみなすピーク (dBFS)。これより大きい音が出ていたソースにだけゲインのボタンを出す
export const ACTIVE_PEAK_DB = -50;

// 音が止まってから、音を出しているとみなし続ける時間 (ms)。話の合間で案内が消えないようにする
export const ACTIVE_HOLD_MS = 10000;

/** ソースが最近音を出していたかを、ボリュームメーターのピークから判定する */
export class SoundActivity {
  private lastActiveAt: number | null = null;

  /** ピーク (dBFS、チャンネルごと) を渡し、音を出しているかを返す */
  update(peaks: number[], now: number): boolean {
    if (peaks.some((peak) => peak > ACTIVE_PEAK_DB)) this.lastActiveAt = now;
    return this.lastActiveAt !== null && now - this.lastActiveAt <= ACTIVE_HOLD_MS;
  }
}

/** 現在のゲインより大きい次の段階 (dB)。上限に達していれば null */
export function nextGainStep(currentDb: number): number | null {
  return GAIN_STEPS_DB.find((step) => step > currentDb + EPSILON_DB) ?? null;
}

/** 現在のゲインより小さい前の段階 (dB)。下限に達していれば null */
export function prevGainStep(currentDb: number): number | null {
  return [...GAIN_STEPS_DB].reverse().find((step) => step < currentDb - EPSILON_DB) ?? null;
}

export function isSameGain(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON_DB;
}

/** +6 / -3 / +7.5 のように符号付きで表す */
export function formatGainDb(db: number): string {
  const rounded = Math.round(db * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return rounded > 0 ? `+${text}` : text;
}
