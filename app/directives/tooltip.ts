/**
 * v-tooltip ディレクティブ
 *
 * 使用方法:
 *   v-tooltip="'テキスト'"
 *   v-tooltip.top="'テキスト'"
 *   v-tooltip.bottom="'テキスト'"
 *   v-tooltip.left="'テキスト'"
 *   v-tooltip.right="'テキスト'"
 *
 *
 * 使用箇所一覧:チェック時点のことなので増減あり
 *
 * [Mixer.vue]
 *   - タイトル (bottom): 音声ミキサー説明
 *   - 歯車アイコン (bottom): 高度な音声設定を開く
 *
 * [SourceSelector.vue]
 *   - タイトル (bottom): ソース説明
 *   - フォルダアイコン (bottom): グループを追加
 *   - +アイコン (bottom): ソースを追加
 *   - 鍵アイコン (bottom): ロック
 *   - 目アイコン (bottom): 表示/非表示
 *   - ゴミ箱アイコン (bottom): ソースを削除
 *   - 歯車アイコン (bottom): プロパティ
 *
 * [StreamingController.vue]
 *   - 経過時間 (left): 配信開始からの経過時間
 *   - 録画ボタン (left): 録画パス設定
 *   - リプレイ開始/停止/保存 (left): リプレイ録画機能
 *
 * [StartStreamingButton.vue]
 *   - 大ボタン (left): 配信開始/終了
 *
 * [SceneSelector.vue]
 *   - +アイコン (bottom): シーンを追加
 *   - 切替アイコン (bottom): シーン切り替え
 *   - ゴミ箱アイコン (bottom): シーンを削除
 *
 * [nicolive-area/ToolBar.vue]
 *   - 延長ボタン (bottom): 延長設定
 *   - 番組再取得 (bottom): 番組再取得
 *   - ▼ボタン (bottom): 配信開始/終了ボタンを選択
 *
 * [nicolive-area/ProgramStatistics.vue]
 *   - 来場者数/コメント数/広告ポイント/ギフトポイント (bottom)
 *
 * [nicolive-area/ProgramInfo.vue]
 *   - 番組タイトル (bottom): 番組タイトル文字列
 *
 * [nicolive-area/CommentViewer.vue]
 *   - 更新/フィルター/モデレーター/設定アイコン (bottom)
 *
 * [nicolive-area/CommentFilter.vue]
 *   - 絞り込みアイコン (bottom): 登録者で絞り込み
 *
 * [nicolive-area/comment/CommonComment.vue]
 *   - モデレーター/サポーターバッジ (bottom)
 *
 * [windows/UserInfo.vue]
 *   - モデレーター/サポーターバッジ/その他メニュー (bottom)
 *
 * [windows/RtvcSourceProperties.vue]
 *   - 音声設定/共通設定/サンプル再生等 (bottom/top)
 *
 * [windows/SceneTransitions.vue]
 *   - 警告アイコン (default): 冗長なコネクション警告
 *
 * [TranscriptionSettings.vue]
 *   - 文字起こし機能説明/ダウンロード/キャンセル/削除 (bottom/default)
 *
 */

import { ObjectDirective } from 'vue';

// ========================================
// 型定義
// ========================================

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface Position {
    top: number;
    left: number;
    placement: TooltipPlacement;
}

interface TooltipOptions {
    content: string;
    placement: TooltipPlacement;
    container: string;
    delay: number;
}

interface TooltipElement extends Element {
    _tooltipManager?: TooltipManager;
    _tooltipHandlers?: Record<string, () => void>;
}

// ========================================
// 定数
// ========================================

const DEFAULT_OPTIONS: TooltipOptions = {
  content: '',
  placement: 'top',
  container: '#mainWrapper',
  delay: 0,
};

const TOOLTIP_OFFSET = 10; // ツールチップとターゲット要素の間隔(px)
const VIEWPORT_PADDING = 10; // ビューポート端からの余白(px)
const DISPOSE_TIMEOUT = 5000; // ツールチップDOM要素の自動破棄までの時間(ms)

// ========================================
// 位置計算
// ========================================

/**
 * ツールチップの位置を計算
 * @param targetEl ターゲット要素
 * @param tooltipEl ツールチップ要素
 * @param placement 希望する配置位置
 * @returns 計算された位置と最終的な配置位置
 */
function calculatePosition(
  targetEl: Element,
  tooltipEl: HTMLElement,
  placement: TooltipPlacement,
): Position {
  const targetRect = targetEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  let top = 0;
  let left = 0;
  let finalPlacement = placement;

  // 基本位置を計算
  switch (placement) {
    case 'top':
      top = targetRect.top - tooltipRect.height - TOOLTIP_OFFSET;
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      break;

    case 'bottom':
      top = targetRect.bottom + TOOLTIP_OFFSET;
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      break;

    case 'left':
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.left - tooltipRect.width - TOOLTIP_OFFSET;
      break;

    case 'right':
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.right + TOOLTIP_OFFSET;
      break;
  }

  // 画面外にはみ出す場合は反対側にフリップ
  if (placement === 'top' && top < VIEWPORT_PADDING) {
    // 上にはみ出す場合は下に配置
    finalPlacement = 'bottom';
    top = targetRect.bottom + TOOLTIP_OFFSET;
  } else if (placement === 'bottom' && top + tooltipRect.height > viewport.height - VIEWPORT_PADDING) {
    // 下にはみ出す場合は上に配置
    finalPlacement = 'top';
    top = targetRect.top - tooltipRect.height - TOOLTIP_OFFSET;
  } else if (placement === 'left' && left < VIEWPORT_PADDING) {
    // 左にはみ出す場合は右に配置
    finalPlacement = 'right';
    left = targetRect.right + TOOLTIP_OFFSET;
  } else if (placement === 'right' && left + tooltipRect.width > viewport.width - VIEWPORT_PADDING) {
    // 右にはみ出す場合は左に配置
    finalPlacement = 'left';
    left = targetRect.left - tooltipRect.width - TOOLTIP_OFFSET;
  }

  // 左右のはみ出しを調整（中央寄せの場合）
  if (placement === 'top' || placement === 'bottom') {
    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    } else if (left + tooltipRect.width > viewport.width - VIEWPORT_PADDING) {
      left = viewport.width - tooltipRect.width - VIEWPORT_PADDING;
    }
  }

  // 上下のはみ出しを調整（中央寄せの場合）
  if (placement === 'left' || placement === 'right') {
    if (top < VIEWPORT_PADDING) {
      top = VIEWPORT_PADDING;
    } else if (top + tooltipRect.height > viewport.height - VIEWPORT_PADDING) {
      top = viewport.height - tooltipRect.height - VIEWPORT_PADDING;
    }
  }

  return { top, left, placement: finalPlacement };
}

// ========================================
// TooltipManager クラス
// ========================================

/**
 * ツールチップDOM管理とライフサイクル制御
 */
class TooltipManager {
  private targetEl: Element;
  private tooltipEl: HTMLElement | null = null;
  private options: TooltipOptions;
  private showTimer: number | null = null;
  private disposeTimer: number | null = null;
  private isVisible = false;

  constructor(targetEl: Element, options: Partial<TooltipOptions>) {
    this.targetEl = targetEl;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
     * コンテンツを更新
     */
  setContent(content: string): void {
    this.options.content = content;
    if (this.tooltipEl && this.isVisible) {
      const inner = this.tooltipEl.querySelector('.tooltip-inner');
      if (inner) {
        inner.textContent = content;
      }
    }
  }

  /**
     * 配置位置を更新
     */
  setPlacement(placement: TooltipPlacement): void {
    this.options.placement = placement;
  }

  /**
     * ツールチップを表示
     */
  show(): void {
    this.clearTimer();
    this.scheduleAction(this.doShow.bind(this));
  }

  /**
     * ツールチップを非表示
     */
  hide(): void {
    this.clearTimer();
    this.scheduleAction(this.doHide.bind(this));
  }

  /**
     * ツールチップを破棄
     */
  dispose(): void {
    this.clearTimer();
    this.destroyTooltip();
  }

  /**
     * 遅延付きでアクションをスケジュール
     */
  private scheduleAction(action: () => void): void {
    if (this.options.delay > 0) {
      this.showTimer = window.setTimeout(action, this.options.delay);
    } else {
      action();
    }
  }

  /**
     * 実際に表示する処理
     */
  private doShow(): void {
    if (this.isVisible || !this.options.content) return;

    this.clearTimer('dispose');
    this.createTooltip();
    this.updatePosition();
    this.isVisible = true;

    requestAnimationFrame(() => this.tooltipEl?.classList.add('show'));
  }

  /**
     * 実際に非表示にする処理
     */
  private doHide(): void {
    if (!this.isVisible || !this.tooltipEl) return;

    this.isVisible = false;
    this.tooltipEl.classList.remove('show');
    this.disposeTimer = window.setTimeout(() => this.destroyTooltip(), DISPOSE_TIMEOUT);
  }

  /**
     * ツールチップDOM要素を作成
     */
  private createTooltip(): void {
    if (this.tooltipEl) return;

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'tooltip';
    this.tooltipEl.setAttribute('role', 'tooltip');
    this.tooltipEl.innerHTML = `<div class="tooltip-inner">${this.options.content}</div>`;

    const container = document.querySelector(this.options.container) || document.body;
    container.appendChild(this.tooltipEl);
  }

  /**
     * ツールチップDOM要素を破棄
     */
  private destroyTooltip(): void {
    this.tooltipEl?.parentNode?.removeChild(this.tooltipEl);
    this.tooltipEl = null;
  }

  /**
     * ツールチップの位置を更新
     */
  private updatePosition(): void {
    if (!this.tooltipEl) return;

    const { top, left, placement } = calculatePosition(
      this.targetEl,
      this.tooltipEl,
      this.options.placement,
    );

    Object.assign(this.tooltipEl.style, {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
    });
    this.tooltipEl.setAttribute('x-placement', placement);
  }

  /**
     * 指定したタイマーまたは全タイマーをクリア
     */
  private clearTimer(type?: 'show' | 'dispose'): void {
    if (!type || type === 'show') {
      if (this.showTimer !== null) {
        clearTimeout(this.showTimer);
        this.showTimer = null;
      }
    }
    if (!type || type === 'dispose') {
      if (this.disposeTimer !== null) {
        clearTimeout(this.disposeTimer);
        this.disposeTimer = null;
      }
    }
  }
}

// ========================================
// Vue ディレクティブ
// ========================================

/**
 * modifiersから配置位置を取得
 */
function getPlacement(modifiers: Record<string, boolean>): TooltipPlacement {
  if (modifiers.top) return 'top';
  if (modifiers.bottom) return 'bottom';
  if (modifiers.left) return 'left';
  if (modifiers.right) return 'right';
  return 'top'; // デフォルト
}

/**
 * ツールチップのコンテンツを取得
 */
function getContent(value: any): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'content' in value) {
    return String(value.content);
  }
  return String(value || '');
}

const directive: ObjectDirective = {
  beforeMount(el: TooltipElement, binding) {
    const content = getContent(binding.value);
    if (!content) return;

    const manager = new TooltipManager(el, {
      content,
      placement: getPlacement(binding.modifiers),
      container: '#mainWrapper',
      delay: 0,
    });

    el._tooltipManager = manager;

    // イベントハンドラーを設定
    el._tooltipHandlers = {
      mouseenter: () => manager.show(),
      mouseleave: () => manager.hide(),
      focus: () => manager.show(),
      blur: () => manager.hide(),
    };

    Object.entries(el._tooltipHandlers).forEach(([event, handler]) => {
      el.addEventListener(event, handler);
    });

    el.classList.add('has-tooltip');
  },

  updated(el: TooltipElement, binding) {
    const manager = el._tooltipManager;
    if (!manager) return;

    const content = getContent(binding.value);
    if (!content) {
      manager.dispose();
      return;
    }

    manager.setContent(content);
    manager.setPlacement(getPlacement(binding.modifiers));
  },

  beforeUnmount(el: TooltipElement) {
    if (el._tooltipHandlers) {
      Object.entries(el._tooltipHandlers).forEach(([event, handler]) => {
        el.removeEventListener(event, handler);
      });
      delete el._tooltipHandlers;
    }

    if (el._tooltipManager) {
      el._tooltipManager.dispose();
      delete el._tooltipManager;
    }

    el.classList.remove('has-tooltip');
  },
};

export default directive;
