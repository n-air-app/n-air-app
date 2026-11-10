// 目標との差がこの範囲 (LU) なら「適正」とみなす
export const LOUDNESS_TOLERANCE_LU = 3;

/** 配信音声の大きさの判定。none は未確定 (計測開始直後・無音) */
export type LoudnessLevel = 'none' | 'low' | 'ok' | 'high';

export function loudnessLevel(shortTerm: number | null, targetLufs: number): LoudnessLevel {
  if (shortTerm === null) return 'none';
  const diff = shortTerm - targetLufs;
  if (diff < -LOUDNESS_TOLERANCE_LU) return 'low';
  if (diff > LOUDNESS_TOLERANCE_LU) return 'high';
  return 'ok';
}

/**
 * 配信音声が小さい状態か。小さい (low) で true、適正・大きい (ok / high) で false にする。
 * 未確定 (none、無音など) では前の状態を保つ。話の合間で案内が出たり消えたりしないようにするため
 */
export function nextQuiet(prev: boolean, level: LoudnessLevel): boolean {
  if (level === 'low') return true;
  if (level === 'ok' || level === 'high') return false;
  return prev;
}
