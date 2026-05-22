import * as Sentry from '@sentry/vue';

jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
}));

const mockMenuAppend = jest.fn();
const mockMenuItemConstructor = jest.fn((options) => ({ ...options }));
jest.mock('@electron/remote', () => ({
  Menu: jest.fn(() => ({ append: mockMenuAppend, popup: jest.fn() })),
  MenuItem: mockMenuItemConstructor,
  getCurrentWindow: jest.fn(),
}));

describe('Menu.append', () => {
  let mockAddBreadcrumb: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddBreadcrumb = jest.fn();
    jest.spyOn(Sentry, 'addBreadcrumb').mockImplementation(mockAddBreadcrumb);
  });

  function getMenu() {
    const { Menu } = require('./Menu');
    return new Menu();
  }

  test('click なしの append は breadcrumb を記録しない', () => {
    const menu = getMenu();
    menu.append({ label: 'No Click' });
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  test('click ありの append はクリック時に ui.menu breadcrumb を記録する', () => {
    const menu = getMenu();
    const click = jest.fn();
    menu.append({ id: 'Duplicate', label: '複製', click });

    // MenuItem コンストラクタに渡されたオプションの click を取得して呼ぶ
    const passedOptions = mockMenuItemConstructor.mock.calls[0][0];
    passedOptions.click();

    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: 'ui.menu',
      message: 'Duplicate',
      level: 'info',
    });
    expect(click).toHaveBeenCalled();
  });

  test('id がない場合は label を breadcrumb message に使う', () => {
    const menu = getMenu();
    const click = jest.fn();
    menu.append({ label: 'ラベルのみ', click });

    const passedOptions = mockMenuItemConstructor.mock.calls[0][0];
    passedOptions.click();

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'ラベルのみ' }),
    );
  });

  test('breadcrumb 記録後に元の click が呼ばれる', () => {
    const callOrder: string[] = [];
    const menu = getMenu();
    jest.spyOn(Sentry, 'addBreadcrumb').mockImplementation(() => {
      callOrder.push('breadcrumb');
    });
    menu.append({
      id: 'Test',
      click: () => callOrder.push('click'),
    });

    const passedOptions = mockMenuItemConstructor.mock.calls[0][0];
    passedOptions.click();

    expect(callOrder).toEqual(['breadcrumb', 'click']);
  });
});
