const path = require('node:path');

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  runner: '@kayahr/jest-electron-runner',
  modulePaths: [path.resolve(__dirname, 'app')],
  testEnvironment: '@kayahr/jest-electron-runner/environment',
  testEnvironmentOptions: {
    electron: {
      options: ['no-sandbox'],
    },
  },
  roots: ['<rootDir>/app', '<rootDir>/main-process'],
  testMatch: ['**/app/**/*.test.ts', '**/main-process/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(ml-kmeans|ml-distance-euclidean|ml-matrix|ml-nearest-vector|ml-random|ml-xsadd))',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'ts-jest',
  },
};
