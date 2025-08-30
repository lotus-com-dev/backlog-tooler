import type { BaseFeature, FeatureConfig } from '@/core/types';
import { registryLogger } from '@/shared';

export class FeatureRegistry {
  private features: Map<string, BaseFeature> = new Map();
  private featureConfigs: Map<string, FeatureConfig> = new Map();

  register(feature: BaseFeature): void {
    const id = feature.getId();
    if (this.features.has(id)) {
      registryLogger.warn(`Feature ${id} is already registered`);
      return;
    }

    this.features.set(id, feature);
    this.featureConfigs.set(id, {
      id: feature.getId(),
      name: feature.getName(),
      description: '',
      enabled: feature.isEnabled(),
      version: '1.0.0'
    });

    registryLogger.debug(`Registered feature: ${id}`);
  }

  unregister(featureId: string): void {
    const feature = this.features.get(featureId);
    if (feature) {
      // Clean up feature before unregistering
      try {
        feature.cleanup();
      } catch (error) {
        registryLogger.warn(`Error cleaning up feature ${featureId}:`, error);
      }
    }

    this.features.delete(featureId);
    this.featureConfigs.delete(featureId);
    registryLogger.debug(`Unregistered feature: ${featureId}`);
  }

  getFeature(featureId: string): BaseFeature | undefined {
    return this.features.get(featureId);
  }

  getAllFeatures(): BaseFeature[] {
    return Array.from(this.features.values());
  }

  getEnabledFeatures(): BaseFeature[] {
    return Array.from(this.features.values()).filter(feature => feature.isEnabled());
  }

  getFeatureConfig(featureId: string): FeatureConfig | undefined {
    return this.featureConfigs.get(featureId);
  }

  getAllFeatureConfigs(): FeatureConfig[] {
    return Array.from(this.featureConfigs.values());
  }

  setFeatureEnabled(featureId: string, enabled: boolean): boolean {
    const feature = this.features.get(featureId);
    const config = this.featureConfigs.get(featureId);

    if (!feature || !config) {
      registryLogger.warn(`Feature ${featureId} not found`);
      return false;
    }

    feature.setEnabled(enabled);
    config.enabled = enabled;
    
    registryLogger.debug(`Feature ${featureId} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  clear(): void {
    // Clean up all features before clearing
    this.features.forEach((feature, id) => {
      try {
        feature.cleanup();
      } catch (error) {
        registryLogger.warn(`Error cleaning up feature ${id}:`, error);
      }
    });

    this.features.clear();
    this.featureConfigs.clear();
    registryLogger.debug('All features cleared');
  }

  getFeatureCount(): number {
    return this.features.size;
  }
}