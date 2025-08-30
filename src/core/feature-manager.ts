import type { BaseFeature, FeatureContext, PageContext } from '@/core/types';
import { FeatureRegistry } from '@/core/feature-registry';
import { managerLogger } from '@/shared';

export class FeatureManager {
  private registry: FeatureRegistry;
  // private context: FeatureContext; // Reserved for future use
  // private pageContext: PageContext; // Reserved for future use
  private activeFeatures: Set<string> = new Set();
  private isGloballyEnabled = true;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: FeatureContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _pageContext: PageContext
  ) {
    this.registry = new FeatureRegistry();
    // this.context = context; // Reserved for future use
    // this.pageContext = pageContext; // Reserved for future use
  }

  registerFeature(feature: BaseFeature): void {
    this.registry.register(feature);
  }

  async initializeAllFeatures(): Promise<void> {
    const features = this.registry.getEnabledFeatures();
    
    managerLogger.debug(`Initializing ${features.length} enabled features`);

    for (const feature of features) {
      if (feature.shouldActivate() && !this.activeFeatures.has(feature.getId())) {
        try {
          await feature.initialize();
          this.activeFeatures.add(feature.getId());
          managerLogger.debug(`Feature ${feature.getId()} initialized successfully`);
        } catch (error) {
          managerLogger.error(`Failed to initialize feature ${feature.getId()}:`, error);
        }
      }
    }
  }

  async initializeFeature(featureId: string): Promise<boolean> {
    const feature = this.registry.getFeature(featureId);
    
    if (!feature) {
      managerLogger.warn(`Feature ${featureId} not found`);
      return false;
    }

    if (!feature.isEnabled()) {
      managerLogger.debug(`Feature ${featureId} is disabled`);
      return false;
    }

    if (!feature.shouldActivate()) {
      managerLogger.debug(`Feature ${featureId} should not activate in current context`);
      return false;
    }

    if (this.activeFeatures.has(featureId)) {
      managerLogger.debug(`Feature ${featureId} is already active`);
      return true;
    }

    try {
      await feature.initialize();
      this.activeFeatures.add(featureId);
      managerLogger.debug(`Feature ${featureId} initialized successfully`);
      return true;
    } catch (error) {
      managerLogger.error(`Failed to initialize feature ${featureId}:`, error);
      return false;
    }
  }

  cleanupFeature(featureId: string): boolean {
    const feature = this.registry.getFeature(featureId);
    
    if (!feature) {
      managerLogger.warn(`Feature ${featureId} not found`);
      return false;
    }

    try {
      feature.cleanup();
      this.activeFeatures.delete(featureId);
      managerLogger.debug(`Feature ${featureId} cleaned up successfully`);
      return true;
    } catch (error) {
      managerLogger.error(`Failed to cleanup feature ${featureId}:`, error);
      return false;
    }
  }

  cleanupAllFeatures(): void {
    managerLogger.debug(`Cleaning up ${this.activeFeatures.size} active features`);
    
    const activeFeatureIds = Array.from(this.activeFeatures);
    for (const featureId of activeFeatureIds) {
      this.cleanupFeature(featureId);
    }
    
    this.activeFeatures.clear();
  }

  async toggleFeature(featureId: string, enabled: boolean): Promise<boolean> {
    const success = this.registry.setFeatureEnabled(featureId, enabled);
    
    if (!success) {
      return false;
    }

    if (enabled) {
      return await this.initializeFeature(featureId);
    } else {
      return this.cleanupFeature(featureId);
    }
  }

  setGloballyEnabled(enabled: boolean): void {
    this.isGloballyEnabled = enabled;
    
    if (enabled) {
      this.initializeAllFeatures();
    } else {
      this.cleanupAllFeatures();
    }
  }

  isFeatureActive(featureId: string): boolean {
    return this.activeFeatures.has(featureId);
  }

  getActiveFeatureIds(): string[] {
    return Array.from(this.activeFeatures);
  }

  getRegistry(): FeatureRegistry {
    return this.registry;
  }

  async handleNavigation(): Promise<void> {
    // Cleanup features that shouldn't be active in new context
    const activeFeatureIds = Array.from(this.activeFeatures);
    for (const featureId of activeFeatureIds) {
      const feature = this.registry.getFeature(featureId);
      if (feature && !feature.shouldActivate()) {
        this.cleanupFeature(featureId);
      }
    }

    // Initialize features that should be active in new context
    await this.initializeAllFeatures();
  }

  getStatus() {
    return {
      globallyEnabled: this.isGloballyEnabled,
      totalFeatures: this.registry.getFeatureCount(),
      activeFeatures: this.activeFeatures.size,
      enabledFeatures: this.registry.getEnabledFeatures().length,
      featureConfigs: this.registry.getAllFeatureConfigs()
    };
  }
}