const path = require('node:path');

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'ts-jest',
      modulePaths: [path.resolve(__dirname, 'app')],
      moduleNameMapper: {
        '^electron$': '<rootDir>/app/test-setup/electron.js',
        '^@electron/remote$': '<rootDir>/app/test-setup/electron-remote.js',
      },
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/app/test-setup/environment.js'],
      roots: ['<rootDir>/app'],
      testMatch: ['**/app/**/*.test.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!(ml-kmeans|ml-distance-euclidean|ml-matrix|ml-nearest-vector|ml-random|ml-xsadd))',
      ],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
    },
    {
      displayName: 'main-process',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/main-process'],
      testMatch: ['**/main-process/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
    },
  ],
};
