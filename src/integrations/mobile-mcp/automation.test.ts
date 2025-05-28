/**
 * Tests for MobileAutomation
 */

import { MobileAutomation, ElementInfo } from './automation';
import { MobileMCPClient } from './client';
import { ElementSelector } from '../../types';

// Mock the MCP client
jest.mock('./client');
jest.mock('../../utils/logger');

const MockMobileMCPClient = MobileMCPClient as jest.MockedClass<
  typeof MobileMCPClient
>;

describe('MobileAutomation', () => {
  let automation: MobileAutomation;
  let mockClient: jest.Mocked<MobileMCPClient>;

  beforeEach(() => {
    mockClient = new MockMobileMCPClient(
      {} as any
    ) as jest.Mocked<MobileMCPClient>;
    mockClient.sendRequest = jest.fn();
    automation = new MobileAutomation(mockClient);
  });

  describe('launchApp', () => {
    it('should launch app successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.launchApp('com.example.app');

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_launch_app',
        { packageName: 'com.example.app' }
      );
    });

    it('should handle launch app failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('Launch failed'));

      await expect(automation.launchApp('com.example.app')).rejects.toThrow(
        'Failed to launch app com.example.app: Launch failed'
      );
    });
  });

  describe('terminateApp', () => {
    it('should terminate app successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.terminateApp('com.example.app');

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_terminate_app',
        { packageName: 'com.example.app' }
      );
    });

    it('should handle terminate app failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('Terminate failed'));

      await expect(automation.terminateApp('com.example.app')).rejects.toThrow(
        'Failed to terminate app com.example.app: Terminate failed'
      );
    });
  });

  describe('tapElement', () => {
    const mockElement: ElementInfo = {
      id: 'test-button',
      text: 'Test Button',
      className: 'Button',
      bounds: { x: 100, y: 200, width: 50, height: 30 },
      visible: true,
      enabled: true,
    };

    beforeEach(() => {
      // Mock findElement to return our test element
      jest.spyOn(automation, 'findElement').mockResolvedValue(mockElement);
    });

    it('should tap element at center coordinates', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      const selector: ElementSelector = { type: 'id', value: 'test-button' };
      await automation.tapElement(selector);

      expect(automation.findElement).toHaveBeenCalledWith(selector);
      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_click_on_screen_at_coordinates',
        { x: 125, y: 215 } // Center of bounds (100+50/2, 200+30/2)
      );
    });

    it('should handle tap element failure', async () => {
      jest
        .spyOn(automation, 'findElement')
        .mockRejectedValue(new Error('Element not found'));

      const selector: ElementSelector = { type: 'id', value: 'missing-button' };
      await expect(automation.tapElement(selector)).rejects.toThrow(
        'Failed to tap element: Element not found'
      );
    });
  });

  describe('typeText', () => {
    it('should type text successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.typeText('Hello World', false);

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_type_keys',
        { text: 'Hello World', submit: false }
      );
    });

    it('should type text with submit', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.typeText('Hello World', true);

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_type_keys',
        { text: 'Hello World', submit: true }
      );
    });

    it('should handle type text failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('Type failed'));

      await expect(automation.typeText('test')).rejects.toThrow(
        'Failed to type text: Type failed'
      );
    });
  });

  describe('takeScreenshot', () => {
    it('should take screenshot successfully', async () => {
      const mockScreenshotData = {
        base64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        width: 1080,
        height: 1920,
      };
      mockClient.sendRequest.mockResolvedValue(mockScreenshotData);

      const result = await automation.takeScreenshot();

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_take_screenshot',
        { random_string: 'screenshot' }
      );
      expect(result).toEqual({
        base64: mockScreenshotData.base64,
        width: 1080,
        height: 1920,
        timestamp: expect.any(Date),
      });
    });

    it('should handle screenshot with alternative response format', async () => {
      const mockScreenshotData = {
        screenshot: 'base64data',
        width: 0,
        height: 0,
      };
      mockClient.sendRequest.mockResolvedValue(mockScreenshotData);

      const result = await automation.takeScreenshot();

      expect(result.base64).toBe('base64data');
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('should handle screenshot failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('Screenshot failed'));

      await expect(automation.takeScreenshot()).rejects.toThrow(
        'Failed to take screenshot: Screenshot failed'
      );
    });
  });

  describe('waitForElement', () => {
    const selector: ElementSelector = { type: 'id', value: 'loading-spinner' };

    it('should wait for element to become visible', async () => {
      const mockElement: ElementInfo = {
        id: 'loading-spinner',
        bounds: { x: 0, y: 0, width: 50, height: 50 },
        visible: true,
        enabled: true,
      };

      jest.spyOn(automation, 'findElement').mockResolvedValue(mockElement);

      const result = await automation.waitForElement(selector, 1000);

      expect(result).toEqual(mockElement);
      expect(automation.findElement).toHaveBeenCalledWith(selector);
    });

    it('should timeout when element not found', async () => {
      jest
        .spyOn(automation, 'findElement')
        .mockRejectedValue(new Error('Element not found'));

      await expect(automation.waitForElement(selector, 100)).rejects.toThrow(
        'Element not found within 100ms'
      );
    });

    it('should wait for invisible element to become visible', async () => {
      const invisibleElement: ElementInfo = {
        id: 'loading-spinner',
        bounds: { x: 0, y: 0, width: 50, height: 50 },
        visible: false,
        enabled: true,
      };

      const visibleElement: ElementInfo = {
        ...invisibleElement,
        visible: true,
      };

      jest
        .spyOn(automation, 'findElement')
        .mockResolvedValueOnce(invisibleElement)
        .mockResolvedValueOnce(visibleElement);

      const result = await automation.waitForElement(selector, 1000);

      expect(result).toEqual(visibleElement);
      expect(automation.findElement).toHaveBeenCalledTimes(2);
    });
  });

  describe('findElement', () => {
    const mockElements = [
      {
        id: 'button1',
        resourceId: 'com.example:id/button1',
        text: 'Click Me',
        className: 'Button',
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        visible: true,
        enabled: true,
      },
      {
        id: 'button2',
        text: 'Submit',
        className: 'Button',
        bounds: { x: 0, y: 60, width: 100, height: 50 },
        visible: true,
        enabled: true,
      },
    ];

    beforeEach(() => {
      mockClient.sendRequest.mockResolvedValue(mockElements);
    });

    it('should find element by id', async () => {
      const selector: ElementSelector = { type: 'id', value: 'button1' };
      const result = await automation.findElement(selector);

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_list_elements_on_screen',
        { random_string: 'find_element' }
      );
      expect(result.id).toBe('button1');
    });

    it('should find element by text', async () => {
      const selector: ElementSelector = { type: 'text', value: 'Submit' };
      const result = await automation.findElement(selector);

      expect(result.text).toBe('Submit');
    });

    it('should find element by class', async () => {
      const selector: ElementSelector = { type: 'class', value: 'Button' };
      const result = await automation.findElement(selector);

      expect(result.className).toBe('Button');
    });

    it('should throw error when element not found', async () => {
      const selector: ElementSelector = {
        type: 'id',
        value: 'missing-element',
      };

      await expect(automation.findElement(selector)).rejects.toThrow(
        'Failed to find element: Element not found'
      );
    });

    it('should handle list elements failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('List failed'));
      const selector: ElementSelector = { type: 'id', value: 'button1' };

      await expect(automation.findElement(selector)).rejects.toThrow(
        'Failed to find element: List failed'
      );
    });
  });

  describe('getScreenSize', () => {
    it('should get screen size successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({ width: 1080, height: 1920 });

      const result = await automation.getScreenSize();

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_get_screen_size',
        { random_string: 'screen_size' }
      );
      expect(result).toEqual({ width: 1080, height: 1920 });
    });

    it('should handle get screen size failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('Screen size failed'));

      await expect(automation.getScreenSize()).rejects.toThrow(
        'Failed to get screen size: Screen size failed'
      );
    });
  });

  describe('swipe', () => {
    it('should swipe up successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.swipe('up');

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_swipe_on_screen',
        { direction: 'up' }
      );
    });

    it('should swipe down successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.swipe('down');

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_swipe_on_screen',
        { direction: 'down' }
      );
    });

    it('should handle swipe failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('Swipe failed'));

      await expect(automation.swipe('up')).rejects.toThrow(
        'Failed to swipe up: Swipe failed'
      );
    });
  });

  describe('pressButton', () => {
    it('should press back button successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.pressButton('BACK');

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_press_button',
        { button: 'BACK' }
      );
    });

    it('should press home button successfully', async () => {
      mockClient.sendRequest.mockResolvedValue({});

      await automation.pressButton('HOME');

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_press_button',
        { button: 'HOME' }
      );
    });

    it('should handle press button failure', async () => {
      mockClient.sendRequest.mockRejectedValue(
        new Error('Button press failed')
      );

      await expect(automation.pressButton('BACK')).rejects.toThrow(
        'Failed to press button BACK: Button press failed'
      );
    });
  });

  describe('getInstalledApps', () => {
    it('should get installed apps successfully', async () => {
      const mockApps = ['com.example.app1', 'com.example.app2'];
      mockClient.sendRequest.mockResolvedValue({ apps: mockApps });

      const result = await automation.getInstalledApps();

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        'mcp_mobile-mcp_mobile_list_apps',
        { random_string: 'list_apps' }
      );
      expect(result).toEqual(mockApps);
    });

    it('should handle alternative response format', async () => {
      const mockApps = ['com.example.app1', 'com.example.app2'];
      mockClient.sendRequest.mockResolvedValue(mockApps);

      const result = await automation.getInstalledApps();

      expect(result).toEqual(mockApps);
    });

    it('should handle get installed apps failure', async () => {
      mockClient.sendRequest.mockRejectedValue(new Error('List apps failed'));

      await expect(automation.getInstalledApps()).rejects.toThrow(
        'Failed to get installed apps: List apps failed'
      );
    });
  });
});
