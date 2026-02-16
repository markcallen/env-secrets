/** @type {import('ts-jest').JestConfigWithTsJest} */
// eslint-disable-next-line no-undef
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__e2e__/setup.ts'],
  testMatch: ['<rootDir>/__e2e__/**/*.test.ts'],
  testTimeout: 30000 // 30 seconds timeout for e2e tests
};
