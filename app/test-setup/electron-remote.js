const BrowserWindow = jest.fn(() => ({
  close: jest.fn(),
  loadURL: jest.fn(),
  removeMenu: jest.fn(),
  webContents: {
    on: jest.fn(),
    send: jest.fn(),
  },
}));
BrowserWindow.getAllWindows = jest.fn(() => []);
BrowserWindow.getFocusedWindow = jest.fn();

module.exports = {
  app: {
    getAppMetrics: jest.fn(() => [{ cpu: { percentCPUUsage: 0 } }]),
    getPath: jest.fn(() => ''),
    getVersion: jest.fn(() => '0.0.0'),
  },
  BrowserWindow,
  dialog: {
    showErrorBox: jest.fn(),
    showMessageBox: jest.fn(),
    showMessageBoxSync: jest.fn(),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  getCurrentWindow: jest.fn(),
  process,
  shell: {
    openExternal: jest.fn(),
    openPath: jest.fn(),
  },
};
