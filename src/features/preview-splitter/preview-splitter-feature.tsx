import { BaseFeature } from '@/core';
import type { FeatureConfig, FeatureContext, PageContext } from '@/core';
import { DOM_SELECTORS } from '@/shared';

// Constants for PreviewSplitterFeature
const SELECTORS = {
  COMMENT_EDITOR: '.comment-editor',
  PREVIEW_MENU: '.comment-editor__preview-menu',
  PREVIEW_MENU_ITEM: '.comment-editor__preview-menu-item',
  SPLIT_BUTTON: '.backlog-tooler-split-button',
  PREVIEW_BUTTON: '.js_previewButton',
  EDITOR_BUTTON: '.js_editorButton'
} as const;

const CSS_CLASSES = {
  SPLIT_VIEW: 'backlog-tooler-split-view',
  SPLIT_BUTTON: 'backlog-tooler-split-button',
  PREVIEW_CLASS: 'is_preview'
} as const;

const STORAGE_KEYS = {
  SPLIT_VIEW_STATE: 'backlog-tooler-split-view'
} as const;

const TIMEOUTS = {
  DOM_ELEMENT_WAIT: 10000, // 10 seconds
  BUTTON_CREATION_DELAY: 500, // 500ms
  PREVIEW_CONTENT_DELAY: 100 // 100ms
} as const;

const STYLES = {
  BUTTON_MARGIN: '8px'
} as const;

export class PreviewSplitterFeature extends BaseFeature {
  private previewWrapperElement: HTMLElement | null = null;
  private textareaElement: HTMLElement | null = null;
  private previewContentElement: HTMLElement | null = null;
  private actionWrapperElement: HTMLElement | null = null;
  private commentEditorElement: HTMLElement | null = null;
  private previewMenuElement: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private splitViewButton: HTMLElement | null = null;
  private isSplitViewActive: boolean = false;
  private wasInPreviewMode: boolean = false;
  private isMonitoringSetup: boolean = false;
  private heightObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private layoutObserver: MutationObserver | null = null;

  constructor(
    featureConfig: FeatureConfig,
    context: FeatureContext,
    pageContext: PageContext
  ) {
    super(featureConfig, context, pageContext);
  }

  shouldActivate(): boolean {
    return this.pageContext.isAddPage();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.logger.debug('Initializing preview splitter...');
    this.logger.debug('Current URL:', window.location.href);
    this.logger.debug('Should activate:', this.shouldActivate());
    
    try {
      // Wait for DOM elements to be available
      await this.waitForElements();
      
      // Inject CSS styles (but don't apply split view yet)
      this.injectStyles();
      
      // Setup monitoring (only once) - this will handle button creation
      this.setupMonitoring();
      
      // Check for existing preview menu and create button if needed
      this.checkAndCreateSplitButton();
      
      // Also check again after a short delay to catch dynamic elements
      setTimeout(() => {
        this.checkAndCreateSplitButton();
      }, TIMEOUTS.BUTTON_CREATION_DELAY);
      
      // Load saved state from localStorage
      this.loadSavedState();
      
      this.setInitialized(true);
      this.logger.info('Preview splitter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize preview splitter', error);
      throw error;
    }
  }

  cleanup(): void {
    this.logger.debug('Cleaning up preview splitter...');
    
    try {
      // Disable split view if active
      if (this.isSplitViewActive) {
        this.disableSplitView();
      }
      
      // Remove split view button
      if (this.splitViewButton && this.splitViewButton.parentNode) {
        this.splitViewButton.parentNode.removeChild(this.splitViewButton);
      }
      
      // Cleanup observers
      this.cleanupObservers();
      
      // Remove injected styles
      if (this.styleElement && this.styleElement.parentNode) {
        this.styleElement.parentNode.removeChild(this.styleElement);
      }
      
      // Reset element references
      this.previewWrapperElement = null;
      this.textareaElement = null;
      this.previewContentElement = null;
      this.actionWrapperElement = null;
      this.commentEditorElement = null;
      this.previewMenuElement = null;
      this.styleElement = null;
      this.splitViewButton = null;
      this.heightObserver = null;
      this.resizeObserver = null;
      this.layoutObserver = null;
      this.isSplitViewActive = false;
      this.wasInPreviewMode = false;
      this.isMonitoringSetup = false;
      
      this.setInitialized(false);
    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }

  private async waitForElements(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for DOM elements'));
      }, TIMEOUTS.DOM_ELEMENT_WAIT);

      const checkElements = () => {
        this.actionWrapperElement = document.querySelector(DOM_SELECTORS.COMMENT_EDITOR_ACTION_WRAPPER);
        this.previewWrapperElement = document.querySelector(DOM_SELECTORS.COMMENT_EDITOR_PREVIEW_WRAPPER);
        this.textareaElement = document.querySelector(DOM_SELECTORS.COMMENT_EDITOR_TEXTAREA);
        this.commentEditorElement = document.querySelector(SELECTORS.COMMENT_EDITOR);
        this.previewMenuElement = document.querySelector(SELECTORS.PREVIEW_MENU);

        // Only require basic elements for initialization
        if (this.previewWrapperElement && this.textareaElement && this.actionWrapperElement) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        // Use MutationObserver for more efficient waiting
        const observer = new MutationObserver(() => {
          checkElements();
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        // Track observer for cleanup
        this.context.resourceTracker.trackObserver(observer);

        // Clean up observer when elements are found
        const originalResolve = resolve;
        resolve = () => {
          observer.disconnect();
          this.context.resourceTracker.untrackObserver(observer);
          originalResolve();
        };
      };

      checkElements();
    });
  }

  private createSplitViewButton(): void {
    if (!this.previewMenuElement) {
      this.logger.debug('Preview menu element not found, will try later');
      return;
    }

    // Check if button already exists
    if (this.previewMenuElement.querySelector(SELECTORS.SPLIT_BUTTON)) {
      this.logger.debug('Split button already exists in preview menu');
      return;
    }

    // Create button element with exact same classes as preview button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = SELECTORS.PREVIEW_MENU_ITEM.slice(1); // Remove the dot
    button.textContent = '二分割';
    button.title = 'エディタとプレビューを並べて表示';
    
    // Add our custom class for identification and active state
    button.classList.add(CSS_CLASSES.SPLIT_BUTTON);
    
    this.splitViewButton = button;

    // Add click event listener
    this.splitViewButton.addEventListener('click', (event) => {
      event.preventDefault();
      this.logger.debug('Split view button clicked, current state:', this.isSplitViewActive);
      this.toggleSplitView();
    });

    // Find the preview button to insert after it
    const previewButton = this.previewMenuElement.querySelector(SELECTORS.PREVIEW_BUTTON) || 
                         Array.from(this.previewMenuElement.querySelectorAll(SELECTORS.PREVIEW_MENU_ITEM))
                               .find(btn => btn.textContent?.includes('プレビュー'));
    
    if (previewButton && previewButton.parentNode) {
      this.logger.debug('Inserting split button after preview button');
      previewButton.parentNode.insertBefore(this.splitViewButton, previewButton.nextSibling);
    } else {
      this.logger.debug('Preview button not found, appending to preview menu');
      this.previewMenuElement.appendChild(this.splitViewButton);
    }

    this.logger.debug('Split view button created and added to preview menu');
  }

  private toggleSplitView(): void {
    if (this.isSplitViewActive) {
      this.disableSplitView();
    } else {
      this.enableSplitView();
    }
  }

  private enableSplitView(): void {
    if (!this.previewWrapperElement || !this.textareaElement) {
      this.logger.error('Required elements not found for enabling split view');
      return;
    }

    this.logger.debug('Enabling split view...');

    // Record initial preview mode state before making changes
    this.recordInitialPreviewState();

    // Trigger preview button to ensure preview content is loaded
    this.triggerPreviewDisplay();

    // Wait a bit for preview content to load, then get the element
    setTimeout(() => {
      if (!this.previewContentElement) {
        this.previewContentElement = document.querySelector(DOM_SELECTORS.COMMENT_EDITOR_PREVIEW_CONTENT);
      }
      
      // Remove is_preview class to maintain edit mode
      this.removePreviewClass();
      
      // Apply split view layout
      this.applySplitViewLayout();
      
      // Perform initial height sync
      setTimeout(() => this.performHeightSync(), 50);
    }, TIMEOUTS.PREVIEW_CONTENT_DELAY);

    // Update button state
    if (this.splitViewButton) {
      this.splitViewButton.classList.add('active');
    }

    // Save state
    this.isSplitViewActive = true;
    this.saveState();

    this.logger.info('Split view enabled');
  }

  private disableSplitView(): void {
    if (!this.previewWrapperElement) {
      return;
    }

    this.logger.debug('Disabling split view...');

    // Remove split view class
    this.previewWrapperElement.classList.remove(CSS_CLASSES.SPLIT_VIEW);

    // Restore original display
    if (this.textareaElement) {
      (this.textareaElement as HTMLElement).style.display = '';
    }

    // Reset preview content height and hide it
    if (this.previewContentElement) {
      this.previewContentElement.style.height = '';
      this.previewContentElement.style.minHeight = '';
      this.previewContentElement.style.maxHeight = '';
      this.previewContentElement.style.display = 'none';
    }

    // Restore original mode based on initial state
    this.restoreOriginalMode();

    // Update button state
    if (this.splitViewButton) {
      this.splitViewButton.classList.remove('active');
    }

    // Save state
    this.isSplitViewActive = false;
    this.saveState();

    this.logger.info('Split view disabled');
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SPLIT_VIEW_STATE, JSON.stringify(this.isSplitViewActive));
    } catch (error) {
      this.logger.error('Failed to save state to localStorage', error);
    }
  }

  private loadSavedState(): void {
    try {
      const savedState = localStorage.getItem(STORAGE_KEYS.SPLIT_VIEW_STATE);
      if (savedState !== null) {
        const isActive = JSON.parse(savedState);
        if (isActive) {
          this.enableSplitView();
        }
      }
    } catch (error) {
      this.logger.error('Failed to load state from localStorage', error);
    }
  }

  private applySplitViewLayout(): void {
    if (!this.previewWrapperElement || !this.textareaElement) {
      this.logger.error('Required DOM elements not found');
      return;
    }

    this.logger.debug('Applying split view layout...');

    // Add split view class to enable the layout
    this.previewWrapperElement.classList.add(CSS_CLASSES.SPLIT_VIEW);
    
    // Force textarea to be visible
    (this.textareaElement as HTMLElement).style.display = 'block';

    // Sync heights if monitoring is already setup
    if (this.isMonitoringSetup) {
      this.performHeightSync();
    }

    this.logger.debug('Split view layout applied successfully');
  }

  private injectStyles(): void {
    // Create style element
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = `
      /* Preview Splitter Feature Styles */
      .backlog-tooler-split-view {
        display: flex !important;
        flex-wrap: wrap;
        gap: 0 !important;
        align-items: flex-start;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Allow flex items to shrink and grow freely when resized */
      .backlog-tooler-split-view .comment-editor__textarea:is([style*="width"]) {
        flex-basis: auto !important;
      }

      .backlog-tooler-split-view .comment-editor__preview-content:has(~ .comment-editor__textarea[style*="width"]) {
        flex: 1 1 auto !important;
      }

      .backlog-tooler-split-view .comment-editor__textarea {
        display: block !important;
        flex: 1 1 50%;
        min-width: 300px;
        max-width: none;
        resize: both !important;
        order: 1;
        margin: 0 !important;
        padding: 12px;
        overflow: auto;
        box-sizing: border-box;
        border-right: 1px solid #e1e5e9;
      }

      .backlog-tooler-split-view .comment-editor__preview-content {
        display: block !important;
        flex: 1 1 50%;
        min-width: 300px;
        min-height: 240px;
        height: 100%;
        border: 1px solid #e1e5e9;
        border-left: none;
        border-radius: 0;
        padding: 12px;
        background: #fff;
        box-sizing: border-box;
        order: 2;
        margin: 0 !important;
        overflow-y: auto;
        word-wrap: break-word;
      }

      /* Match heights between textarea and preview */
      .backlog-tooler-split-view {
        align-items: stretch !important;
      }

      .backlog-tooler-split-view .comment-editor__preview-content[style*="min-height"] {
        height: auto !important;
        min-height: inherit !important;
      }

      .backlog-tooler-split-view .comment-editor__action-wrapper {
        flex-basis: 100%;
        width: 100%;
        order: 3;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Preserve toolbar button spacing - DO NOT modify these */
      .backlog-tooler-split-view .comment-editor__tools-content,
      .backlog-tooler-split-view .button-list.comment-editor__tools,
      .backlog-tooler-split-view .button-list.comment-editor__tools * {
        /* Preserve original spacing for toolbar buttons */
      }

      /* Split view button inherits all preview menu item styles */
      /* Add spacing between preview button and split button */
      .${CSS_CLASSES.SPLIT_BUTTON} {
        margin-left: ${STYLES.BUTTON_MARGIN};
      }

      /* Only add minimal custom styling for active state */
      .${CSS_CLASSES.SPLIT_BUTTON}.active {
        background: #e6f4ff !important;
        border-color: #1890ff !important;
      }

      .${CSS_CLASSES.SPLIT_BUTTON}.active:hover {
        background: #bae0ff !important;
      }

      /* Ensure preview content is always visible */
      .backlog-tooler-split-view .comment-editor__preview-content[style*="display: none"] {
        display: block !important;
      }

      /* Responsive adjustments */
      @media (max-width: 900px) {
        .backlog-tooler-split-view {
          flex-direction: column;
          gap: 0 !important;
        }
        
        .backlog-tooler-split-view .comment-editor__textarea {
          flex: 1 1 auto;
          min-width: 0;
          border-right: none;
          border-bottom: 1px solid #e1e5e9;
        }

        .backlog-tooler-split-view .comment-editor__preview-content {
          flex: 1 1 auto;
          min-width: 0;
          border-left: 1px solid #e1e5e9;
        }

        .backlog-tooler-split-view .comment-editor__action-wrapper {
          margin: 0 !important;
        }
      }
    `;

    // Append to head
    document.head.appendChild(this.styleElement);

    this.logger.debug('Styles injected successfully');
  }


  private setupMonitoring(): void {
    if (this.isMonitoringSetup) {
      this.logger.debug('Monitoring already setup, skipping...');
      return;
    }

    this.logger.debug('Setting up monitoring...');

    // Setup layout monitor
    this.setupLayoutMonitor();
    
    // Setup height sync
    this.setupHeightSync();
    
    // Setup preview content monitor
    this.setupPreviewContentMonitor();
    
    // Setup preview menu monitor
    this.setupPreviewMenuMonitor();
    
    this.isMonitoringSetup = true;
    this.logger.debug('Monitoring setup completed');
  }

  private cleanupObservers(): void {
    if (this.layoutObserver) {
      this.layoutObserver.disconnect();
      this.context.resourceTracker.untrackObserver(this.layoutObserver);
      this.layoutObserver = null;
    }

    if (this.heightObserver) {
      this.heightObserver.disconnect();
      this.context.resourceTracker.untrackObserver(this.heightObserver);
      this.heightObserver = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.isMonitoringSetup = false;
    this.logger.debug('Observers cleaned up');
  }

  private setupLayoutMonitor(): void {
    // Monitor for changes that might remove our class
    if (!this.previewWrapperElement || this.layoutObserver) return;

    this.layoutObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          if (target === this.previewWrapperElement && 
              this.isSplitViewActive &&
              !target.classList.contains('backlog-tooler-split-view')) {
            this.logger.debug('Split view class was removed, reapplying...');
            target.classList.add('backlog-tooler-split-view');
          }
          
          // Monitor comment-editor element for is_preview class
          if (target.classList.contains('comment-editor') && 
              this.isSplitViewActive &&
              target.classList.contains('is_preview')) {
            this.logger.debug('is_preview class was added during split view, removing...');
            target.classList.remove('is_preview');
          }
        }
      });
    });

    this.layoutObserver.observe(this.previewWrapperElement, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });

    // Also observe comment-editor element for class changes
    if (this.commentEditorElement) {
      this.layoutObserver.observe(this.commentEditorElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    // Also observe preview content element for style changes
    if (this.previewContentElement) {
      this.layoutObserver.observe(this.previewContentElement, {
        attributes: true,
        attributeFilter: ['style']
      });
    }

    this.context.resourceTracker.trackObserver(this.layoutObserver);
    this.logger.debug('Layout monitor setup completed');
  }

  private setupHeightSync(): void {
    if (!this.textareaElement || this.heightObserver) return;

    // Watch for height changes on textarea
    this.heightObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'height')) {
          if (this.isSplitViewActive) {
            // Delay slightly to ensure the change has been applied
            setTimeout(() => this.performHeightSync(), 10);
          }
        }
      });
    });

    this.heightObserver.observe(this.textareaElement, {
      attributes: true,
      attributeFilter: ['style', 'height']
    });

    // Also use ResizeObserver for more comprehensive monitoring
    if (window.ResizeObserver && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.isSplitViewActive) {
          for (const entry of entries) {
            if (entry.target === this.textareaElement) {
              // Delay slightly to ensure all styles are applied
              setTimeout(() => this.performHeightSync(), 10);
              break;
            }
          }
        }
      });

      this.resizeObserver.observe(this.textareaElement);
    }

    this.context.resourceTracker.trackObserver(this.heightObserver);
    this.logger.debug('Height sync setup completed');
  }

  private performHeightSync(): void {
    if (!this.textareaElement || !this.previewContentElement || !this.isSplitViewActive) return;

    // Get the actual computed height of textarea
    const textareaComputedStyle = window.getComputedStyle(this.textareaElement);
    const textareaHeight = this.textareaElement.style.height || textareaComputedStyle.height;
    
    if (textareaHeight && textareaHeight !== 'auto' && textareaHeight !== '0px') {
      // Apply the height to preview content
      this.previewContentElement.style.height = textareaHeight;
      this.previewContentElement.style.minHeight = textareaHeight;
      this.previewContentElement.style.maxHeight = textareaHeight;
      this.logger.debug('Synced height:', textareaHeight);
    } else {
      // Fallback: use offsetHeight if style height is not available
      const offsetHeight = this.textareaElement.offsetHeight;
      if (offsetHeight > 0) {
        const heightValue = `${offsetHeight}px`;
        this.previewContentElement.style.height = heightValue;
        this.previewContentElement.style.minHeight = heightValue;
        this.previewContentElement.style.maxHeight = heightValue;
        this.logger.debug('Synced height using offsetHeight:', heightValue);
      }
    }
  }

  private triggerPreviewDisplay(): void {
    // Find the preview button (usually labeled as "プレビュー" or similar)
    const previewButton = document.querySelector(SELECTORS.PREVIEW_BUTTON) as HTMLButtonElement;
    
    if (previewButton) {
      this.logger.debug('Triggering preview button click');
      previewButton.click();
    } else {
      // Alternative: look for preview button by text content
      const buttons = document.querySelectorAll(SELECTORS.PREVIEW_MENU_ITEM);
      for (const button of buttons) {
        if (button.textContent?.includes('プレビュー')) {
          this.logger.debug('Triggering preview button click (by text)');
          (button as HTMLButtonElement).click();
          break;
        }
      }
    }
  }

  private setupPreviewContentMonitor(): void {
    // Monitor for preview content element creation
    if (!this.previewWrapperElement) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.matches(DOM_SELECTORS.COMMENT_EDITOR_PREVIEW_CONTENT)) {
                this.logger.debug('Preview content element detected');
                this.previewContentElement = element as HTMLElement;
                
                // If split view is active, apply layout again
                if (this.isSplitViewActive) {
                  this.applySplitViewLayout();
                }
              }
            }
          });
        }
      });
    });

    observer.observe(this.previewWrapperElement, {
      childList: true,
      subtree: true
    });

    this.context.resourceTracker.trackObserver(observer);
    this.logger.debug('Preview content monitor setup completed');
  }

  private setupPreviewMenuMonitor(): void {
    // Monitor for preview menu creation
    if (!this.actionWrapperElement) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.matches(SELECTORS.PREVIEW_MENU)) {
                this.logger.debug('Preview menu element detected');
                this.previewMenuElement = element as HTMLElement;
                
                // Create split view button if not already created
                if (!this.splitViewButton) {
                  this.createSplitViewButton();
                }
              }
            }
          });
        }
      });
    });

    observer.observe(this.actionWrapperElement, {
      childList: true,
      subtree: true
    });

    this.context.resourceTracker.trackObserver(observer);
    this.logger.debug('Preview menu monitor setup completed');
  }

  private checkAndCreateSplitButton(): void {
    // Check if preview menu already exists
    if (!this.previewMenuElement) {
      this.previewMenuElement = document.querySelector(SELECTORS.PREVIEW_MENU);
    }

    // If preview menu exists and button doesn't exist yet, create it
    if (this.previewMenuElement && !this.splitViewButton) {
      this.logger.debug('Found existing preview menu, creating split button');
      this.createSplitViewButton();
    }
  }

  private removePreviewClass(): void {
    if (!this.commentEditorElement) {
      this.commentEditorElement = document.querySelector(SELECTORS.COMMENT_EDITOR);
    }

    if (this.commentEditorElement && this.commentEditorElement.classList.contains(CSS_CLASSES.PREVIEW_CLASS)) {
      this.logger.debug('Removing is_preview class to maintain edit mode');
      this.commentEditorElement.classList.remove(CSS_CLASSES.PREVIEW_CLASS);
    }
  }

  private recordInitialPreviewState(): void {
    if (!this.commentEditorElement) {
      this.commentEditorElement = document.querySelector(SELECTORS.COMMENT_EDITOR);
    }

    if (this.commentEditorElement) {
      this.wasInPreviewMode = this.commentEditorElement.classList.contains(CSS_CLASSES.PREVIEW_CLASS);
      this.logger.debug('Initial preview state recorded:', this.wasInPreviewMode ? 'preview mode' : 'edit mode');
    }
  }

  private restoreOriginalMode(): void {
    if (this.wasInPreviewMode) {
      // Was originally in preview mode - restore preview mode
      this.restorePreviewClass();
    } else {
      // Was originally in edit mode - switch to edit mode
      this.switchToEditMode();
    }
  }

  private restorePreviewClass(): void {
    if (!this.commentEditorElement) {
      this.commentEditorElement = document.querySelector(SELECTORS.COMMENT_EDITOR);
    }

    // Only restore is_preview class if it was originally in preview mode
    if (this.commentEditorElement && 
        this.wasInPreviewMode && 
        !this.commentEditorElement.classList.contains(CSS_CLASSES.PREVIEW_CLASS)) {
      this.logger.debug('Restoring is_preview class (was originally in preview mode)');
      this.commentEditorElement.classList.add(CSS_CLASSES.PREVIEW_CLASS);
    }
  }

  private switchToEditMode(): void {
    // Find and click the edit button to return to edit mode
    const editButton = document.querySelector(SELECTORS.EDITOR_BUTTON) ||
                      Array.from(document.querySelectorAll(SELECTORS.PREVIEW_MENU_ITEM))
                        .find(btn => btn.textContent?.includes('編集'));
    
    if (editButton) {
      this.logger.debug('Switching back to edit mode (was originally in edit mode)');
      (editButton as HTMLButtonElement).click();
    } else {
      this.logger.debug('Edit button not found, removing is_preview class manually');
      if (this.commentEditorElement) {
        this.commentEditorElement.classList.remove(CSS_CLASSES.PREVIEW_CLASS);
      }
    }
  }
}