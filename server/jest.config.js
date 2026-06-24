/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  testTimeout: 15000,
};
