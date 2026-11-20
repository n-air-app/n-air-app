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
 * 配信音声が目標から外れている状態か。小さい・大きい (low / high) で true、適正 (ok) で false にする。
 * 未確定 (none、無音など) では前の状態を保つ。話の合間で表示が出たり消えたりしないようにするため
 */
export function nextOffTarget(prev: boolean, level: LoudnessLevel): boolean {
  if (level === 'low' || level === 'high') return true;
  if (level === 'ok') return false;
  return prev;
}
