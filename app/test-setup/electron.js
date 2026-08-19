const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn(),
  removeListener: jest.fn(),
  send: jest.fn(),
  sendSync: jest.fn(),
};

module.exports = {
  BrowserWindow: jest.fn(),
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => ''),
    getVersion: jest.fn(() => '0.0.0'),
  },
  clipboard: {
    readText: jest.fn(() => ''),
    writeText: jest.fn(),
  },
  ipcRenderer,
  nativeImage: {
    createFromPath: jest.fn(),
  },
  net: {
    request: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
    openPath: jest.fn(),
  },
};

module.exports.default = module.exports;
