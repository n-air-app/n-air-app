/**
 * Popper コンポーネント - N Air用軽量実装
 * 
 * 使用方法:
 *   <popper placement="bottom-start">
 *     <div class="popper">
 *       <ul class="popup-menu-list">
 *         <li class="popup-menu-item">
 *           <a @click="action()">メニュー項目</a>
 *         </li>
 *       </ul>
 *     </div>
 *     <button slot="reference">トリガー</button>
 *   </popper>
 * 
 * 自動クローズを無効化する場合（従来方式）:
 *   // .vue.ts側
 *   popper: { doClose(): void };
 * 
 *   // .vue側
 *   <popper placement="bottom-start" :close-on-content-click="false" @show="popper = $event">
 *     <div class="popper">
 *       <ul class="popup-menu-list">
 *         <li class="popup-menu-item">
 *           <a @click="action(); popper.doClose()">メニュー項目</a>
 *         </li>
 *       </ul>
 *     </div>
 *     <button slot="reference">トリガー</button>
 *   </popper>
 * 
 * Props:
 *   - placement: 'bottom' | 'bottom-start' | 'bottom-end' | 'top' | 'top-start' | ... (デフォルト: 'bottom')
 *   - width: string (例: '240px', '100%') - ポップアップの幅。未指定の場合はコンテンツに依存
 *   - closeOnContentClick: boolean (デフォルト: true) - メニュー項目クリック時に自動的に閉じるか
 * 
 * Events:
 *   - @show: ポップアップが表示された時
 *   - @hide: ポップアップが非表示になった時
 * 
 * 依存関係: なし
 * 
 * 使用箇所一覧:確認時点のものなので、今後増える可能性あり
 * - app/components/nicolive-area/AreaSwitcher.vue
 *     番組エリア切り替えメニュー（placement: bottom-start）
 * 
 * - app/components/nicolive-area/ToolBar.vue
 *     ツールバーのメニュー表示（placement: bottom-end）
 * 
 * - app/components/nicolive-area/ProgramInfo.vue
 *     番組情報のメニュー表示（placement: bottom-end）
 * 
 * - app/components/nicolive-area/CommentFilter.vue
 *     コメントフィルターのメニュー表示（placement: bottom）
 * 
 * - app/components/windows/UserInfo.vue
 *     ユーザー情報のドロップダウンメニュー（placement: bottom-end）
 * 
 * - app/components/windows/RtvcSourceProperties.vue
 *     RTVC設定のメニュー表示（placement: bottom-end）
 * 
 * - app/components/SceneSelector.vue
 *     シーンコレクション選択ドロップダウン（placement: bottom-start）
 */

import { defineComponent, nextTick, onBeforeUnmount, onMounted, PropType, ref, watch } from 'vue';

type Placement =
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
    | 'right'
    | 'right-start'
    | 'right-end';

interface Position {
    top: number;
    left: number;
}

const POPPER_OFFSET = 5;
const VIEWPORT_PADDING = 10;

/**
 * 位置計算（tooltip.tsと類似だが、start/end対応）
 */
function calculatePosition(
    referenceEl: Element,
    popperEl: HTMLElement,
    placement: Placement,
): Position {
    const refRect = referenceEl.getBoundingClientRect();
    const popperRect = popperEl.getBoundingClientRect();
    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
    };

    let top = 0;
    let left = 0;

    // 基本配置を解析
    const [mainPlacement, subPlacement] = placement.split('-') as [string, string?];

    switch (mainPlacement) {
        case 'top':
            top = refRect.top - popperRect.height - POPPER_OFFSET;
            left = getHorizontalPosition(refRect, popperRect, subPlacement);
            break;
        case 'bottom':
            top = refRect.bottom + POPPER_OFFSET;
            left = getHorizontalPosition(refRect, popperRect, subPlacement);
            break;
        case 'left':
            left = refRect.left - popperRect.width - POPPER_OFFSET;
            top = getVerticalPosition(refRect, popperRect, subPlacement);
            break;
        case 'right':
            left = refRect.right + POPPER_OFFSET;
            top = getVerticalPosition(refRect, popperRect, subPlacement);
            break;
    }

    // ビューポート調整
    if (left < VIEWPORT_PADDING) {
        left = VIEWPORT_PADDING;
    } else if (left + popperRect.width > viewport.width - VIEWPORT_PADDING) {
        left = viewport.width - popperRect.width - VIEWPORT_PADDING;
    }

    if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
    } else if (top + popperRect.height > viewport.height - VIEWPORT_PADDING) {
        top = viewport.height - popperRect.height - VIEWPORT_PADDING;
    }

    return { top, left };
}

function getHorizontalPosition(
    refRect: DOMRect,
    popperRect: DOMRect,
    align?: string,
): number {
    switch (align) {
        case 'start':
            return refRect.left;
        case 'end':
            return refRect.right - popperRect.width;
        default:
            return refRect.left + (refRect.width - popperRect.width) / 2;
    }
}

function getVerticalPosition(
    refRect: DOMRect,
    popperRect: DOMRect,
    align?: string,
): number {
    switch (align) {
        case 'start':
            return refRect.top;
        case 'end':
            return refRect.bottom - popperRect.height;
        default:
            return refRect.top + (refRect.height - popperRect.height) / 2;
    }
}

export default defineComponent({
    name: 'Popper',
    props: {
        placement: {
            type: String as PropType<Placement>,
            default: 'bottom',
        },
        width: {
            type: String,
            default: undefined,
        },
        closeOnContentClick: {
            type: Boolean,
            default: true,
        },
    },
    setup(props, { emit, slots }) {
        const showPopper = ref(false);
        const referenceEl = ref<Element | null>(null);
        const popperEl = ref<HTMLElement | null>(null);
        // テンプレート ref: slot コンテンツのラッパー要素
        const referenceWrapper = ref<HTMLElement | null>(null);
        const popperWrapper = ref<HTMLElement | null>(null);

        const updatePosition = () => {
            if (!referenceEl.value || !popperEl.value) return;

            const placement = props.placement;

            // width を先に設定してから寸法を測定する
            // 未設定のまま getBoundingClientRect を呼ぶと viewport 端に追い込まれて
            // 幅が圧縮され、高さが異常に大きくなって位置計算がおかしくなる
            if (props.width !== undefined) {
                popperEl.value.style.width = props.width;
            }

            const { top, left } = calculatePosition(referenceEl.value, popperEl.value, placement);

            Object.assign(popperEl.value.style, {
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
            });

            popperEl.value.setAttribute('x-placement', placement);
        };

        const doShow = () => {
            showPopper.value = true;
        };

        const doClose = () => {
            showPopper.value = false;
        };

        const onReferenceClick = (event: Event) => {
            // 開く場合は、まず document クリックイベントを伝播させて
            // 他のポップアップを閉じてから、次のティックで開く
            if (!showPopper.value) {
                // stopPropagation しないことで、他のポップアップの
                // onDocumentClick が発火して閉じる
                nextTick(() => {
                    doShow();
                });
            } else {
                // 閉じる場合は stopPropagation して即座に実行
                event.stopPropagation();
                doClose();
            }
        };

        const onPopperClick = (event: Event) => {
            // popper 内のクリックが document に伝播しないようにする
            event.stopPropagation();

            if (props.closeOnContentClick) {
                doClose();
            }
        };

        const onDocumentClick = (event: Event) => {
            if (!showPopper.value) return;

            const target = event.target as Node;
            // ref で保持している要素を使用（すでに正しい参照を持っている）
            if (popperEl.value?.contains(target) || referenceEl.value?.contains(target)) {
                return;
            }

            emit('documentClick');
            doClose();
        };

        watch(showPopper, (value) => {
            if (value) {
                // @show イベントで doClose メソッドを渡す（従来方式のため）
                emit('show', { doClose });
                nextTick(() => updatePosition());
            } else {
                emit('hide');
            }
        });

        onMounted(() => {
            // テンプレート ref 経由で slot コンテンツの DOM 要素を取得する。
            // slots.xxx()[0].elm は setup() 呼び出し時に新しい VNode が生成されるため
            // .elm が未設定になる場合があり使用できない。
            // ラッパー span の firstElementChild が実際のコンテンツ要素となる。
            if (referenceWrapper.value?.firstElementChild) {
                referenceEl.value = referenceWrapper.value.firstElementChild;
            }
            if (popperWrapper.value?.firstElementChild) {
                popperEl.value = popperWrapper.value.firstElementChild as HTMLElement;
            }

            referenceEl.value?.addEventListener('click', onReferenceClick);
            popperEl.value?.addEventListener('click', onPopperClick);
            document.addEventListener('click', onDocumentClick);
        });

        onBeforeUnmount(() => {
            referenceEl.value?.removeEventListener('click', onReferenceClick);
            popperEl.value?.removeEventListener('click', onPopperClick);
            document.removeEventListener('click', onDocumentClick);
        });

        return {
            showPopper,
            doClose,
            referenceWrapper,
            popperWrapper,
        };
    },
});
