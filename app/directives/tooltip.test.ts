import directive from './tooltip';

describe('v-tooltip directive', () => {
  let targetEl: HTMLElement;
  let containerEl: HTMLElement;

  beforeEach(() => {
    // コンテナを作成
    containerEl = document.createElement('div');
    containerEl.id = 'mainWrapper';
    document.body.appendChild(containerEl);

    // ターゲット要素を作成
    targetEl = document.createElement('button');
    targetEl.textContent = 'Test Button';
    document.body.appendChild(targetEl);

    // getBoundingClientRectをモック
    targetEl.getBoundingClientRect = jest.fn(() => ({
      top: 100,
      left: 100,
      bottom: 130,
      right: 200,
      width: 100,
      height: 30,
      x: 100,
      y: 100,
      toJSON: () => { },
    }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('マウスホバーでツールチップが表示される', async () => {
    const vnode = {} as any;
    const oldVnode = {} as any;

    // ディレクティブをバインド
    directive.bind?.(targetEl, {
      name: 'tooltip',
      value: 'テストツールチップ',
      modifiers: { bottom: true },
      oldValue: undefined,
      arg: undefined,
    }, vnode, oldVnode);

    // ツールチップ要素はまだ存在しない
    expect(containerEl.querySelector('.tooltip')).toBeNull();

    // マウスエンターイベントを発火
    targetEl.dispatchEvent(new MouseEvent('mouseenter'));

    // requestAnimationFrameを待つ
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(undefined));
    });
    await new Promise((resolve) => {
      setTimeout(() => resolve(undefined), 10);
    });

    // ツールチップ要素が生成されている
    const tooltipEl = containerEl.querySelector('.tooltip');
    expect(tooltipEl).not.toBeNull();
    expect(tooltipEl?.classList.contains('show')).toBe(true);

    // コンテンツが正しい
    const innerEl = tooltipEl?.querySelector('.tooltip-inner');
    expect(innerEl?.textContent).toBe('テストツールチップ');

    // x-placement属性が設定されている
    expect(tooltipEl?.getAttribute('x-placement')).toBe('bottom');

    // クリーンアップ
    directive.unbind?.(targetEl, {} as any, vnode, oldVnode);
  });
});
