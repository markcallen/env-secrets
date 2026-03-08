import {
  LocalStackHelper,
  createTestProfile,
  restoreTestProfile,
  TestProfileContext,
  TestSecret,
  CreatedSecret
} from './test-utils';

export interface AwsE2eContext {
  createTestSecret: (
    secret: TestSecret,
    region?: string
  ) => Promise<CreatedSecret>;
  getLocalStackEnv: (
    overrides?: Record<string, string>
  ) => Record<string, string>;
}

export function registerAwsE2eContext(): AwsE2eContext {
  let localStack: LocalStackHelper;
  let profileContext: TestProfileContext | undefined;

  beforeAll(async () => {
    localStack = new LocalStackHelper();
    await localStack.waitForLocalStack();
    profileContext = createTestProfile();
  });

  afterAll(async () => {
    await localStack.cleanupRunSecrets();
    restoreTestProfile(profileContext);
  });

  return {
    createTestSecret: async (
      secret: TestSecret,
      region?: string
    ): Promise<CreatedSecret> => {
      return await localStack.createSecret(secret, region);
    },
    getLocalStackEnv: (overrides: Record<string, string> = {}) => ({
      AWS_ENDPOINT_URL: process.env.LOCALSTACK_URL || 'http://localhost:4566',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      AWS_DEFAULT_REGION: 'us-east-1',
      ...overrides
    })
  };
}
