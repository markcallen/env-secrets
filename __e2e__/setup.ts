// E2E Test Setup
// This file runs before all e2e tests

import { LocalStackHelper, checkAwslocalInstalled } from './utils/test-utils';
import { debugLog, debugError } from './utils/debug-logger';

// Increase timeout for e2e tests
jest.setTimeout(30000);

// Global setup for e2e tests
beforeAll(async () => {
  debugLog('Setting up E2E test environment...');

  // Check if awslocal is installed
  await checkAwslocalInstalled();

  // Check if LocalStack is available
  const localStack = new LocalStackHelper();
  try {
    await localStack.waitForLocalStack();
    debugLog('LocalStack is ready for E2E tests');
  } catch (error) {
    debugError(
      'LocalStack is not available, some tests may fail:',
      error.message
    );
    process.exit(1);
  }
});

// Global cleanup
afterAll(async () => {
  debugLog('Cleaning up E2E test environment...');
});

// Suppress console.log during tests unless DEBUG is set
// But always show console.error and console.warn for debugging
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

beforeEach(() => {
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
    // Keep console.error and console.warn enabled for debugging
  }
});

afterEach(() => {
  if (!process.env.DEBUG) {
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;
    // console.error and console.warn are already enabled
  }
});
