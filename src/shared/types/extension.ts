export interface StorageData {
  enabled: boolean;
  features?: FeatureSettings;
}

export interface FeatureSettings {
  [featureId: string]: {
    enabled: boolean;
    config?: Record<string, unknown>;
  };
}

