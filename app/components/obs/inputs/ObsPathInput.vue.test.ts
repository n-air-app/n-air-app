/**
 * ObsPathInput.showFileDialog の unit test
 *
 * ダイアログの応答待ち中にコンポーネントが破棄されるなどして
 * $refs.input が null になっても例外を投げないことを確認する (N-AIR-APP-GCR)。
 */
import * as remote from '@electron/remote';

jest.mock('@electron/remote', () => ({
  dialog: { showOpenDialog: jest.fn() },
  getCurrentWindow: jest.fn(),
}));

const ObsPathInput = require('./ObsPathInput.vue.ts').default;

function makeContext(refsInput: HTMLInputElement | null) {
  return {
    value: { name: 'test', type: 'OBS_PROPERTY_FILE', value: '', filters: [] },
    $refs: { input: refsInput },
    $emit: jest.fn(),
    handleChange: ObsPathInput.methods.handleChange,
    emitInput: ObsPathInput.methods.emitInput,
  };
}

describe('ObsPathInput.showFileDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('$refs.input が null ならクラッシュせず何もしない (N-AIR-APP-GCR)', async () => {
    (remote.dialog.showOpenDialog as jest.Mock).mockResolvedValue({
      filePaths: ['C:/selected.txt'],
    });
    const ctx = makeContext(null);

    await expect(ObsPathInput.methods.showFileDialog.call(ctx)).resolves.toBeUndefined();
    expect(ctx.$emit).not.toHaveBeenCalled();
  });

  test('$refs.input が存在する場合は value を設定して input イベントを emit する', async () => {
    (remote.dialog.showOpenDialog as jest.Mock).mockResolvedValue({
      filePaths: ['C:/selected.txt'],
    });
    const input = { value: '' } as HTMLInputElement;
    const ctx = makeContext(input);

    await ObsPathInput.methods.showFileDialog.call(ctx);

    expect(input.value).toBe('C:/selected.txt');
    expect(ctx.$emit).toHaveBeenCalledWith(
      'input',
      expect.objectContaining({ value: 'C:/selected.txt' }),
    );
  });

  test('ファイルが選択されなかった場合は何もしない', async () => {
    (remote.dialog.showOpenDialog as jest.Mock).mockResolvedValue({ filePaths: [] });
    const input = { value: '' } as HTMLInputElement;
    const ctx = makeContext(input);

    await ObsPathInput.methods.showFileDialog.call(ctx);

    expect(input.value).toBe('');
    expect(ctx.$emit).not.toHaveBeenCalled();
  });
});
