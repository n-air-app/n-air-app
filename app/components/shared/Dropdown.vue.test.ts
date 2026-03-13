/**
 * Dropdown コンポーネントの unit test
 *
 * defineComponent の setup() を直接呼び出してロジックをテストする。
 * Vue 2.7 の Composition API は component instance 外でも動作する。
 */
import { reactive } from 'vue';

// ─── ヘルパー ───────────────────────────────────────────────────────────────

const defaultProps = {
    value: null as any,
    options: [] as any[],
    label: null as string | null,
    trackBy: null as string | null,
    disabled: false,
    loading: false,
    placeholder: '',
    searchable: false,
};

type Props = typeof defaultProps;

function callSetup(propsOverrides: Partial<Props> = {}) {
    const emit = jest.fn();
    const props = reactive({ ...defaultProps, ...propsOverrides });
    // defineComponent は Vue 2.7 では options オブジェクトをそのまま返す
    const component = require('./Dropdown.vue.ts').default;
    const result = component.setup(props, {
        emit,
        attrs: {},
        slots: {},
        expose: jest.fn(),
    });
    return { ...result, emit, props };
}

// ─── テスト ─────────────────────────────────────────────────────────────────

describe('Dropdown / value=0 の扱い', () => {
    test('value=0 のとき selectedOption は 0 を返す（null 扱いしない）', () => {
        const { selectedOption } = callSetup({ value: 0, options: [0, 1, 2] });
        expect(selectedOption.value).toBe(0);
    });

    test('value=null のとき selectedOption は null を返す', () => {
        const { selectedOption } = callSetup({ value: null, options: [0, 1, 2] });
        expect(selectedOption.value).toBeNull();
    });

    test('value=0 のとき isSelected(0) は true', () => {
        const { isSelected } = callSetup({ value: 0, options: [0, 1, 2] });
        expect(isSelected(0)).toBe(true);
    });

    test('value=0 のとき isSelected(1) は false', () => {
        const { isSelected } = callSetup({ value: 0, options: [0, 1, 2] });
        expect(isSelected(1)).toBe(false);
    });

    test('value=null のとき isSelected(0) は false', () => {
        const { isSelected } = callSetup({ value: null, options: [0, 1, 2] });
        expect(isSelected(0)).toBe(false);
    });

    test('value="" (空文字) のとき selectedOption は "" を返す（null 扱いしない）', () => {
        const { selectedOption } = callSetup({ value: '', options: ['', 'a', 'b'] });
        expect(selectedOption.value).toBe('');
    });

    test('value="" のとき isSelected("") は true', () => {
        const { isSelected } = callSetup({ value: '', options: ['', 'a', 'b'] });
        expect(isSelected('')).toBe(true);
    });
});

describe('Dropdown / getOptionLabel', () => {
    test('null を渡すと空文字列を返す', () => {
        const { getOptionLabel } = callSetup();
        expect(getOptionLabel(null)).toBe('');
    });

    test('undefined を渡すと空文字列を返す', () => {
        const { getOptionLabel } = callSetup();
        expect(getOptionLabel(undefined)).toBe('');
    });

    test('0 を渡すと "0" を返す', () => {
        const { getOptionLabel } = callSetup();
        expect(getOptionLabel(0)).toBe('0');
    });

    test('空文字列 "" を渡すと "" を返す', () => {
        const { getOptionLabel } = callSetup();
        expect(getOptionLabel('')).toBe('');
    });

    test('label 指定時: オブジェクトの指定プロパティを返す', () => {
        const { getOptionLabel } = callSetup({ label: 'name' });
        expect(getOptionLabel({ name: 'Alice', id: 1 })).toBe('Alice');
    });
});

describe('Dropdown / オブジェクト選択肢 (trackBy)', () => {
    const opts = [
        { id: 0, name: 'Zero' },
        { id: 1, name: 'One' },
    ];

    test('trackBy="id" / value={id:0} → selectedOption は {id:0} を返す', () => {
        const { selectedOption } = callSetup({
            value: { id: 0, name: 'Zero' },
            options: opts,
            trackBy: 'id',
            label: 'name',
        });
        expect(selectedOption.value).toEqual({ id: 0, name: 'Zero' });
    });

    test('trackBy="id" / 別インスタンスでも id が一致すれば isSelected=true', () => {
        const { isSelected } = callSetup({
            value: { id: 0, name: 'Zero' },
            options: opts,
            trackBy: 'id',
            label: 'name',
        });
        // 参照は異なるが id: 0 で一致
        expect(isSelected({ id: 0, name: 'Zero (copy)' })).toBe(true);
        expect(isSelected({ id: 1, name: 'One' })).toBe(false);
    });
});

describe('Dropdown / selectOption', () => {
    test('emit("input", option) を呼び出す', () => {
        const { selectOption, emit } = callSetup({ options: [1, 2, 3] });
        selectOption(2);
        expect(emit).toHaveBeenCalledWith('input', 2);
    });

    test('selectOption 後に isOpen が false になる', () => {
        const { selectOption, openDropdown, isOpen } = callSetup({ options: [1, 2, 3] });
        openDropdown();
        expect(isOpen.value).toBe(true);
        selectOption(1);
        expect(isOpen.value).toBe(false);
    });

    test('value=0 を選択すると emit("input", 0) が呼ばれる', () => {
        const { selectOption, emit } = callSetup({ options: [0, 1, 2] });
        selectOption(0);
        expect(emit).toHaveBeenCalledWith('input', 0);
    });
});

describe('Dropdown / openDropdown / closeDropdown', () => {
    test('disabled=false のとき openDropdown で isOpen=true になる', () => {
        const { openDropdown, isOpen } = callSetup({ disabled: false });
        openDropdown();
        expect(isOpen.value).toBe(true);
    });

    test('disabled=true のとき openDropdown しても isOpen は false のまま', () => {
        const { openDropdown, isOpen } = callSetup({ disabled: true });
        openDropdown();
        expect(isOpen.value).toBe(false);
    });

    test('closeDropdown で isOpen=false かつ searchQuery がリセットされる', () => {
        const { openDropdown, closeDropdown, isOpen, searchQuery } = callSetup({ searchable: true });
        openDropdown();
        searchQuery.value = 'hello';
        closeDropdown();
        expect(isOpen.value).toBe(false);
        expect(searchQuery.value).toBe('');
    });
});

describe('Dropdown / searchable フィルタリング', () => {
    test('searchQuery に一致する選択肢だけを返す', () => {
        const { searchQuery, filteredOptions } = callSetup({
            searchable: true,
            label: 'name',
            options: [{ name: 'apple' }, { name: 'banana' }, { name: 'apricot' }],
        });
        searchQuery.value = 'ap';
        expect(filteredOptions.value).toEqual([{ name: 'apple' }, { name: 'apricot' }]);
    });

    test('searchable=false の場合は searchQuery があっても全件返す', () => {
        const opts = ['apple', 'banana', 'apricot'];
        const { searchQuery, filteredOptions } = callSetup({ searchable: false, options: opts });
        searchQuery.value = 'ap';
        expect(filteredOptions.value).toEqual(opts);
    });

    test('searchQuery が空のときは全件返す', () => {
        const opts = ['apple', 'banana'];
        const { filteredOptions } = callSetup({ searchable: true, options: opts });
        expect(filteredOptions.value).toEqual(opts);
    });
});

describe('Dropdown / キーボードナビゲーション (onKeydown)', () => {
    function keyEvent(key: string): KeyboardEvent {
        return {
            key,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        } as unknown as KeyboardEvent;
    }

    test('閉じている状態で Enter を押すと開く', () => {
        const { onKeydown, isOpen } = callSetup({ options: ['a', 'b'] });
        const e = keyEvent('Enter');
        onKeydown(e);
        expect(isOpen.value).toBe(true);
    });

    test('開いている状態で Escape を押すと閉じる', () => {
        const { onKeydown, openDropdown, isOpen } = callSetup({ options: ['a', 'b'] });
        openDropdown();
        onKeydown(keyEvent('Escape'));
        expect(isOpen.value).toBe(false);
    });

    test('ArrowDown で highlightedIndex が増加する', () => {
        const { onKeydown, openDropdown, highlightedIndex } = callSetup({ options: ['a', 'b', 'c'] });
        openDropdown();
        highlightedIndex.value = 0;
        onKeydown(keyEvent('ArrowDown'));
        expect(highlightedIndex.value).toBe(1);
    });

    test('ArrowUp で highlightedIndex が減少する', () => {
        const { onKeydown, openDropdown, highlightedIndex } = callSetup({ options: ['a', 'b', 'c'] });
        openDropdown();
        highlightedIndex.value = 2;
        onKeydown(keyEvent('ArrowUp'));
        expect(highlightedIndex.value).toBe(1);
    });

    test('ArrowDown は末尾を超えない', () => {
        const { onKeydown, openDropdown, highlightedIndex } = callSetup({ options: ['a', 'b'] });
        openDropdown();
        highlightedIndex.value = 1; // 末尾
        onKeydown(keyEvent('ArrowDown'));
        expect(highlightedIndex.value).toBe(1);
    });

    test('ArrowUp は先頭を超えない', () => {
        const { onKeydown, openDropdown, highlightedIndex } = callSetup({ options: ['a', 'b'] });
        openDropdown();
        highlightedIndex.value = 0; // 先頭
        onKeydown(keyEvent('ArrowUp'));
        expect(highlightedIndex.value).toBe(0);
    });

    test('開いている状態で Enter を押すとハイライト中の option が選択される', () => {
        const { onKeydown, openDropdown, highlightedIndex, emit } = callSetup({
            options: ['a', 'b', 'c'],
        });
        openDropdown();
        highlightedIndex.value = 1;
        onKeydown(keyEvent('Enter'));
        expect(emit).toHaveBeenCalledWith('input', 'b');
    });
});
