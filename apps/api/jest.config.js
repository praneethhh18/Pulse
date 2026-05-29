/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
