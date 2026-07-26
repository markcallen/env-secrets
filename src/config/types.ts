export interface SecretConfig {
  name: string;
  keys?: string[];
}

export interface EnvSecretsConfig {
  provider?: string;
  profile?: string;
  region?: string;
  secrets: SecretConfig[];
}
