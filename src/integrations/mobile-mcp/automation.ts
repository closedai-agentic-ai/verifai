/**
 * Mobile Automation Methods
 * High-level automation methods using Mobile-MCP client
 */

import { MobileMCPClient } from './client';
import { ElementSelector } from '../../types';
import logger from '../../utils/logger';

/**
 * Screenshot result
 */
export interface ScreenshotResult {
  base64: string;
  width: number;
  height: number;
  timestamp: Date;
}

/**
 * Element information
 */
export interface ElementInfo {
  id?: string;
  text?: string;
  className?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
  enabled: boolean;
}

/**
 * Mobile automation wrapper for MCP client
 */
export class MobileAutomation {
  private client: MobileMCPClient;

  constructor(client: MobileMCPClient) {
    this.client = client;
  }

  /**
   * Launch an application by package name
   */
  public async launchApp(packageName: string): Promise<void> {
    logger.info('Launching application', {
      event: 'app_launch_start',
      packageName,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.client.sendRequest('mcp_mobile-mcp_mobile_launch_app', {
        packageName,
      });

      logger.info('Application launched successfully', {
        event: 'app_launch_success',
        packageName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to launch application', {
        event: 'app_launch_error',
        packageName,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to launch app ${packageName}: ${errorMessage}`);
    }
  }

  /**
   * Terminate an application by package name
   */
  public async terminateApp(packageName: string): Promise<void> {
    logger.info('Terminating application', {
      event: 'app_terminate_start',
      packageName,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.client.sendRequest('mcp_mobile-mcp_mobile_terminate_app', {
        packageName,
      });

      logger.info('Application terminated successfully', {
        event: 'app_terminate_success',
        packageName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to terminate application', {
        event: 'app_terminate_error',
        packageName,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(
        `Failed to terminate app ${packageName}: ${errorMessage}`
      );
    }
  }

  /**
   * Tap on an element using selector
   */
  public async tapElement(selector: ElementSelector): Promise<void> {
    logger.info('Tapping element', {
      event: 'element_tap_start',
      selector,
      timestamp: new Date().toISOString(),
    });

    try {
      // First, find the element
      const element = await this.findElement(selector);

      // Calculate center coordinates
      const centerX = element.bounds.x + element.bounds.width / 2;
      const centerY = element.bounds.y + element.bounds.height / 2;

      // Tap at center coordinates
      await this.client.sendRequest(
        'mcp_mobile-mcp_mobile_click_on_screen_at_coordinates',
        {
          x: centerX,
          y: centerY,
        }
      );

      logger.info('Element tapped successfully', {
        event: 'element_tap_success',
        selector,
        coordinates: { x: centerX, y: centerY },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to tap element', {
        event: 'element_tap_error',
        selector,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to tap element: ${errorMessage}`);
    }
  }

  /**
   * Type text into the currently focused element
   */
  public async typeText(text: string, submit: boolean = false): Promise<void> {
    logger.info('Typing text', {
      event: 'text_input_start',
      textLength: text.length,
      submit,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.client.sendRequest('mcp_mobile-mcp_mobile_type_keys', {
        text,
        submit,
      });

      logger.info('Text typed successfully', {
        event: 'text_input_success',
        textLength: text.length,
        submit,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to type text', {
        event: 'text_input_error',
        textLength: text.length,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to type text: ${errorMessage}`);
    }
  }

  /**
   * Take a screenshot of the current screen
   */
  public async takeScreenshot(): Promise<ScreenshotResult> {
    logger.info('Taking screenshot', {
      event: 'screenshot_start',
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.client.sendRequest(
        'mcp_mobile-mcp_mobile_take_screenshot',
        {
          random_string: 'screenshot',
        }
      );

      const screenshot: ScreenshotResult = {
        base64: result.base64 || result.screenshot,
        width: result.width || 0,
        height: result.height || 0,
        timestamp: new Date(),
      };

      logger.info('Screenshot taken successfully', {
        event: 'screenshot_success',
        width: screenshot.width,
        height: screenshot.height,
        timestamp: new Date().toISOString(),
      });

      return screenshot;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to take screenshot', {
        event: 'screenshot_error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to take screenshot: ${errorMessage}`);
    }
  }

  /**
   * Wait for an element to appear on screen
   */
  public async waitForElement(
    selector: ElementSelector,
    timeout: number = 10000
  ): Promise<ElementInfo> {
    logger.info('Waiting for element', {
      event: 'element_wait_start',
      selector,
      timeout,
      timestamp: new Date().toISOString(),
    });

    const startTime = Date.now();
    const pollInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeout) {
      try {
        const element = await this.findElement(selector);
        if (element.visible) {
          logger.info('Element found and visible', {
            event: 'element_wait_success',
            selector,
            waitTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          });
          return element;
        }
      } catch (error) {
        // Element not found, continue waiting
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    logger.error('Element wait timeout', {
      event: 'element_wait_timeout',
      selector,
      timeout,
      timestamp: new Date().toISOString(),
    });

    throw new Error(
      `Element not found within ${timeout}ms: ${JSON.stringify(selector)}`
    );
  }

  /**
   * Find an element using selector
   */
  public async findElement(selector: ElementSelector): Promise<ElementInfo> {
    try {
      // Get all elements on screen
      const elements = await this.client.sendRequest(
        'mcp_mobile-mcp_mobile_list_elements_on_screen',
        {
          random_string: 'find_element',
        }
      );

      // Find matching element based on selector type
      for (const element of elements) {
        if (this.matchesSelector(element, selector)) {
          return this.parseElementInfo(element);
        }
      }

      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to find element: ${errorMessage}`);
    }
  }

  /**
   * Get screen size
   */
  public async getScreenSize(): Promise<{ width: number; height: number }> {
    try {
      const result = await this.client.sendRequest(
        'mcp_mobile-mcp_mobile_get_screen_size',
        {
          random_string: 'screen_size',
        }
      );

      return {
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get screen size: ${errorMessage}`);
    }
  }

  /**
   * Swipe on screen
   */
  public async swipe(direction: 'up' | 'down'): Promise<void> {
    logger.info('Swiping on screen', {
      event: 'swipe_start',
      direction,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.client.sendRequest('mcp_mobile-mcp_swipe_on_screen', {
        direction,
      });

      logger.info('Swipe completed successfully', {
        event: 'swipe_success',
        direction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to swipe', {
        event: 'swipe_error',
        direction,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to swipe ${direction}: ${errorMessage}`);
    }
  }

  /**
   * Press device button
   */
  public async pressButton(
    button: 'BACK' | 'HOME' | 'VOLUME_UP' | 'VOLUME_DOWN' | 'ENTER'
  ): Promise<void> {
    logger.info('Pressing button', {
      event: 'button_press_start',
      button,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.client.sendRequest('mcp_mobile-mcp_mobile_press_button', {
        button,
      });

      logger.info('Button pressed successfully', {
        event: 'button_press_success',
        button,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to press button', {
        event: 'button_press_error',
        button,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to press button ${button}: ${errorMessage}`);
    }
  }

  /**
   * Get list of installed apps
   */
  public async getInstalledApps(): Promise<string[]> {
    try {
      const result = await this.client.sendRequest(
        'mcp_mobile-mcp_mobile_list_apps',
        {
          random_string: 'list_apps',
        }
      );

      return result.apps || result || [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get installed apps: ${errorMessage}`);
    }
  }

  /**
   * Check if element matches selector
   */
  private matchesSelector(element: any, selector: ElementSelector): boolean {
    switch (selector.type) {
      case 'id':
        return (
          element.id === selector.value || element.resourceId === selector.value
        );
      case 'text':
        return (
          element.text === selector.value ||
          element.contentDescription === selector.value
        );
      case 'class':
        return (
          element.className === selector.value ||
          element.class === selector.value
        );
      case 'xpath':
        // XPath matching would require more complex logic
        // For now, we'll skip XPath selectors
        return false;
      case 'accessibility':
        return (
          element.contentDescription === selector.value ||
          element.accessibilityId === selector.value
        );
      default:
        return false;
    }
  }

  /**
   * Parse element information from MCP response
   */
  private parseElementInfo(element: any): ElementInfo {
    return {
      id: element.id || element.resourceId,
      text: element.text || element.contentDescription,
      className: element.className || element.class,
      bounds: {
        x: element.bounds?.x || element.x || 0,
        y: element.bounds?.y || element.y || 0,
        width: element.bounds?.width || element.width || 0,
        height: element.bounds?.height || element.height || 0,
      },
      visible: element.visible !== false,
      enabled: element.enabled !== false,
    };
  }
}

export default MobileAutomation;
