import { computed, defineComponent, nextTick, PropType, ref, watch } from 'vue';

/**
 * Dropdown - カスタムドロップダウンコンポーネント
 *
 * vue-multiselectから置き換えられたドロップダウンコンポーネント。
 * 文字列配列またはオブジェクト配列を選択肢として表示できます。
 *
 * ## 使用方法
 *
 * ### 文字列配列の場合
 * ```vue
 * <dropdown
 *   v-model="selectedValue"
 *   :options="['Option 1', 'Option 2', 'Option 3']"
 * />
 * ```
 *
 * ### オブジェクト配列の場合（label と track-by が必須）
 * ```vue
 * <dropdown
 *   v-model="selectedItem"
 *   :options="items"
 *   label="name"
 *   track-by="id"
 * />
 * ```
 *
 * ### スロットでカスタマイズ
 * ```vue
 * <dropdown v-model="selected" :options="options" label="name" track-by="id">
 *   <template slot="singleLabel" slot-scope="{ option }">
 *     {{ option.name }}
 *   </template>
 *   <template slot="option" slot-scope="{ option }">
 *     {{ option.name }}
 *   </template>
 * </dropdown>
 * ```
 *
 * ## Props
 * - value: 選択中の値（v-modelで使用）
 * - options: 選択肢の配列（文字列配列またはオブジェクト配列）
 * - label: オブジェクト配列の場合、表示テキストのプロパティ名（必須）
 * - track-by: オブジェクト配列の場合、一意識別子のプロパティ名（必須）
 * - disabled: 無効化フラグ
 * - loading: ローディング表示フラグ
 * - placeholder: 未選択時のプレースホルダー（値が常にある場合は表示されない）
 * - data-variant: スタイルバリアント（"default" | "filled"）
 *
 * ## 現在の利用箇所
 *
 * ### 直接利用
 * - CommentSettings.vue
 *   - httpRelationMethod (label="text", track-by="value")
 * - SubStreamSettings.vue
 *   - videoCodec (label="name", track-by="id")
 *   - audioCodec (label="name", track-by="id")
 * - ObsListInput.vue (label="description", track-by="value")
 *   - allowEmpty=true の場合のみplaceholder表示可能
 * - ObsResolutionInput.vue (label="description", track-by="value")
 * - ObsSystemFontSelector.vue
 *   - fontFamily (label="family", track-by="family")
 *   - fontStyle (label="style", track-by="style")
 * - ObsFontSizeSelector.vue（文字列配列）
 * - ObsGoogleFontSelector.vue（文字列配列）
 * - RtvcSourceProperties.vue（複数箇所、label="description", track-by="value"）
 *
 * ### ラッパーコンポーネント経由
 * - DropdownIcon.vue（アイコン付きドロップダウン、label="name", track-by="id"）
 *   - CommentSettings.vueでsystem/normal/operator/voicevox系の選択に使用
 */

// クリックアウトサイドディレクティブを外部で定義
const clickOutsideDirective = {
    bind(el: HTMLElement, binding: any) {
        const handler = (event: MouseEvent) => {
            if (!el.contains(event.target as Node)) {
                binding.value(event);
            }
        };
        (el as any).__clickOutsideHandler__ = handler;
        document.addEventListener('click', handler);
    },
    unbind(el: HTMLElement) {
        const handler = (el as any).__clickOutsideHandler__;
        if (handler) {
            document.removeEventListener('click', handler);
            delete (el as any).__clickOutsideHandler__;
        }
    },
};

export default defineComponent({
    name: 'Dropdown',
    directives: {
        clickOutside: clickOutsideDirective,
    },
    props: {
        value: {
            type: null as any,
            default: null,
        },
        // ドロップダウンの選択肢（文字列配列またはオブジェクト配列）
        // オブジェクト配列を使う場合は label と trackBy の指定が必須
        options: {
            type: Array as PropType<any[]>,
            required: true,
        },
        // オプションからラベル（表示テキスト）を取得するプロパティ名
        // オブジェクトのオプションを使う場合は必ず指定すること
        label: {
            type: String as PropType<string | null>,
            default: null,
        },
        // オプションを一意に識別するプロパティ名（比較や:key生成に使用）
        // オブジェクトのオプションを使う場合は必ず指定すること
        trackBy: {
            type: String as PropType<string | null>,
            default: null,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
        loading: {
            type: Boolean,
            default: false,
        },
        placeholder: {
            type: String,
            default: '',
        },
        // 検索機能（trueにするとテキスト入力で選択肢を絞り込み可能）
        searchable: {
            type: Boolean,
            default: false,
        },
    },
    setup(props, { emit }) {
        const isOpen = ref(false);
        const searchQuery = ref('');
        const searchInputEl = ref<HTMLInputElement | null>(null);
        const dropdownInputEl = ref<HTMLInputElement | null>(null);
        const menuEl = ref<HTMLElement | null>(null);
        const highlightedIndex = ref(-1);

        // オプション比較ロジック
        // trackBy指定時: 指定プロパティで比較
        // trackBy未指定: 参照比較（オブジェクトの場合はtrackByの指定を推奨）
        const compareOptions = (opt1: any, opt2: any): boolean => {
            if (opt1 === opt2) return true;
            if (opt1 == null || opt2 == null) return false;

            if (props.trackBy && typeof opt1 === 'object' && typeof opt2 === 'object') {
                return opt1[props.trackBy] === opt2[props.trackBy];
            }
            return false;
        };

        // 選択中のオプション
        const selectedOption = computed(() => {
            if (props.value == null) return null;
            const found = props.options.find(opt => compareOptions(opt, props.value));
            return found !== undefined ? found : props.value;
        });

        // オプションのラベルを取得
        // label指定時: 指定プロパティを使用
        // label未指定: 文字列化（オブジェクトの場合はlabelの指定を推奨）
        const getOptionLabel = (option: any): string => {
            if (option == null) return '';
            if (props.label && typeof option === 'object') return option[props.label];
            return String(option);
        };

        // オプションのキーを取得（Vue の :key として使用）
        // trackBy指定時: 指定プロパティを使用
        // trackBy未指定: 文字列化（オブジェクトの場合はtrackByの指定を推奨）
        const getOptionKey = (option: any): string | number => {
            if (props.trackBy && typeof option === 'object') return option[props.trackBy];
            return String(option);
        };

        // オプションが選択されているか判定
        const isSelected = (option: any): boolean => {
            return props.value != null && compareOptions(option, props.value);
        };

        // 検索で絞り込んだ選択肢（searchable=true のときのみフィルタリング）
        const filteredOptions = computed(() => {
            if (!props.searchable || !searchQuery.value) return props.options;
            const q = searchQuery.value.toLowerCase();
            return props.options.filter(opt => getOptionLabel(opt).toLowerCase().includes(q));
        });

        // キーボードナビゲーション用の選択肢一覧
        const navigableOptions = filteredOptions;

        // data-value 属性用
        const dataValue = computed(() => (props.value != null ? String(getOptionKey(props.value)) : ''));

        // ドロップダウンを開く（クリック・ Tab フォーカス共通）
        const openDropdown = () => {
            if (!props.disabled) {
                isOpen.value = true;
            }
        };

        const closeDropdown = () => {
            isOpen.value = false;
            searchQuery.value = '';
        };

        const toggleDropdown = () => {
            if (!props.disabled) {
                if (isOpen.value) {
                    closeDropdown();
                } else {
                    isOpen.value = true;
                }
            }
        };

        // 検索入力ハンドラ
        const onSearchInput = (e: Event) => {
            searchQuery.value = (e.target as HTMLInputElement).value;
            emit('search-change', searchQuery.value);
        };

        // ドロップダウンが開いたとき入力にフォーカス、閉じたらハイライトをリセット
        watch(isOpen, async (newVal) => {
            if (newVal) {
                highlightedIndex.value = navigableOptions.value.findIndex(opt =>
                    compareOptions(opt, props.value),
                );
                await nextTick();
                if (props.searchable) {
                    searchInputEl.value?.focus();
                } else {
                    dropdownInputEl.value?.focus();
                }
            } else {
                highlightedIndex.value = -1;
            }
        });

        // 検索でフィルタが変わったらハイライトをリセット
        watch(filteredOptions, () => {
            highlightedIndex.value = -1;
        });

        // ハイライトが変わったらスクロール
        watch(highlightedIndex, async (idx) => {
            if (idx < 0) return;
            await nextTick();
            if (!menuEl.value) return;
            const items = menuEl.value.querySelectorAll<HTMLElement>('.dropdown__item');
            items[idx]?.scrollIntoView({ block: 'nearest' });
        });

        // キーボードナビゲーション
        const onKeydown = (e: KeyboardEvent) => {
            if (!isOpen.value) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!props.disabled) isOpen.value = true;
                }
                return;
            }
            // 選択肢が開いているとき
            const total = navigableOptions.value.length;
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    e.stopPropagation();
                    highlightedIndex.value = Math.min(highlightedIndex.value + 1, total - 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    e.stopPropagation();
                    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex.value >= 0 && highlightedIndex.value < total) {
                        selectOption(navigableOptions.value[highlightedIndex.value]);
                    } else {
                        closeDropdown();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeDropdown();
                    break;
            }
        };

        // オプション選択
        const selectOption = (option: any) => {
            emit('input', option);
            closeDropdown();
        };

        // コンポーネント外にフォーカスが移ったら閉じる
        const onFocusout = (e: FocusEvent) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                closeDropdown();
            }
        };

        return {
            isOpen,
            searchQuery,
            dataValue,
            searchInputEl,
            dropdownInputEl,
            menuEl,
            highlightedIndex,
            selectedOption,
            filteredOptions,
            getOptionLabel,
            getOptionKey,
            isSelected,
            openDropdown,
            closeDropdown,
            toggleDropdown,
            selectOption,
            onSearchInput,
            onKeydown,
            onFocusout,
        };
    },
});
