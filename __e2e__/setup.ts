// E2E Test Setup
// This file runs before all e2e tests

import { LocalStackHelper, checkAwslocalInstalled } from './utils/test-utils';

// Increase timeout for e2e tests
jest.setTimeout(30000);

// Global setup for e2e tests
beforeAll(async () => {
  console.log('Setting up E2E test environment...');

  // Check if awslocal is installed
  await checkAwslocalInstalled();

  // Check if LocalStack is available
  const localStack = new LocalStackHelper();
  try {
    await localStack.waitForLocalStack();
    console.log('LocalStack is ready for E2E tests');
  } catch (error) {
    console.warn(
      'LocalStack is not available, some tests may fail:',
      error.message
    );
  }
});

// Global cleanup
afterAll(async () => {
  console.log('Cleaning up E2E test environment...');
});

// Suppress console.log during tests unless DEBUG is set
// But always show console.error for debugging
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    // Keep console.error enabled for debugging
  }
});

afterEach(() => {
  if (!process.env.DEBUG) {
    console.log = originalConsoleLog;
    // console.error is already enabled
  }
});
