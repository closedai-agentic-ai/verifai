/**
 * Tests for TestExecutor
 */

import {
  TestExecutor,
  TestExecutionConfig,
  TestExecutionContext,
} from './test-executor';
import {
  MobileMCPClient,
  MobileAutomation,
} from '../../integrations/mobile-mcp';
import { TestInstruction, ApkInfo } from '../../types';

// Mock dependencies
jest.mock('../../integrations/mobile-mcp');
jest.mock('../../utils/logger');

const MockMobileMCPClient = MobileMCPClient as jest.MockedClass<
  typeof MobileMCPClient
>;
const MockMobileAutomation = MobileAutomation as jest.MockedClass<
  typeof MobileAutomation
>;

describe('TestExecutor', () => {
  let executor: TestExecutor;
  let mockClient: jest.Mocked<MobileMCPClient>;
  let mockAutomation: jest.Mocked<MobileAutomation>;
  let config: TestExecutionConfig;
  let context: TestExecutionContext;

  beforeEach(() => {
    config = {
      timeout: 30000,
      screenshotOnFailure: true,
      retryAttempts: 2,
      retryDelay: 1000,
      elementWaitTimeout: 10000,
    };

    context = {
      testRunId: 'test-run-123',
      apkInfo: {
        packageName: 'com.example.app',
        versionName: '1.0.0',
        versionCode: 100,
        downloadUrl: 'https://example.com/app.apk',
        filename: 'app.apk',
        size: 1024000,
        checksum: 'abc123def456',
      } as ApkInfo,
    };

    mockClient = new MockMobileMCPClient(
      {} as any
    ) as jest.Mocked<MobileMCPClient>;
    mockClient.isReady = jest.fn().mockReturnValue(true);
    mockClient.connect = jest.fn().mockResolvedValue(undefined);

    mockAutomation = new MockMobileAutomation(
      mockClient
    ) as jest.Mocked<MobileAutomation>;

    executor = new TestExecutor(mockClient, config);
    // Replace the automation instance with our mock
    (executor as any).automation = mockAutomation;

    jest.clearAllMocks();
  });

  describe('executeTest', () => {
    it('should execute test successfully with all steps passing', async () => {
      const instructions: TestInstruction[] = [
        {
          id: 'step1',
          action: 'LAUNCH_APP',
          description: 'Launch app',
          parameters: { packageName: 'com.example.app' },
          screenshotOnFailure: true,
        },
        {
          id: 'step2',
          action: 'TAP_ELEMENT',
          description: 'Tap login button',
          selector: { type: 'id', value: 'login_button' },
          screenshotOnFailure: true,
        },
      ];

      mockAutomation.launchApp = jest.fn().mockResolvedValue(undefined);
      mockAutomation.tapElement = jest.fn().mockResolvedValue(undefined);

      const result = await executor.executeTest(instructions, context);

      expect(result.status).toBe('completed');
      expect(result.totalSteps).toBe(2);
      expect(result.passedSteps).toBe(2);
      expect(result.failedSteps).toBe(0);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]?.status).toBe('success');
      expect(result.steps[1]?.status).toBe('success');
    });

    it('should handle test failure and stop execution', async () => {
      const instructions: TestInstruction[] = [
        {
          id: 'step1',
          action: 'LAUNCH_APP',
          description: 'Launch app',
          parameters: { packageName: 'com.example.app' },
          screenshotOnFailure: true,
        },
        {
          id: 'step2',
          action: 'TAP_ELEMENT',
          description: 'Tap login button',
          selector: { type: 'id', value: 'login_button' },
          screenshotOnFailure: true,
        },
      ];

      mockAutomation.launchApp = jest.fn().mockResolvedValue(undefined);
      mockAutomation.tapElement = jest
        .fn()
        .mockRejectedValue(new Error('Element not found'));
      mockAutomation.takeScreenshot = jest.fn().mockResolvedValue({
        base64: 'screenshot-data',
        width: 1080,
        height: 1920,
        timestamp: new Date(),
      });

      const result = await executor.executeTest(instructions, context);

      expect(result.status).toBe('failed');
      expect(result.totalSteps).toBe(2);
      expect(result.passedSteps).toBe(1);
      expect(result.failedSteps).toBe(1);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]?.status).toBe('success');
      expect(result.steps[1]?.status).toBe('failed');
      expect(result.steps[1]?.error?.message).toContain('Element not found');
    });

    it('should connect MCP client if not ready', async () => {
      mockClient.isReady.mockReturnValue(false);

      const instructions: TestInstruction[] = [
        {
          id: 'step1',
          action: 'TAKE_SCREENSHOT',
          description: 'Take screenshot',
          screenshotOnFailure: true,
        },
      ];

      mockAutomation.takeScreenshot = jest.fn().mockResolvedValue({
        base64: 'screenshot-data',
        width: 1080,
        height: 1920,
        timestamp: new Date(),
      });

      await executor.executeTest(instructions, context);

      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should handle test execution error', async () => {
      mockClient.isReady.mockReturnValue(false);
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      const instructions: TestInstruction[] = [
        {
          id: 'step1',
          action: 'TAKE_SCREENSHOT',
          description: 'Take screenshot',
          screenshotOnFailure: true,
        },
      ];

      const result = await executor.executeTest(instructions, context);

      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('Connection failed');
    });
  });

  describe('executeStep', () => {
    it('should execute step successfully', async () => {
      const instruction: TestInstruction = {
        id: 'step1',
        action: 'LAUNCH_APP',
        description: 'Launch app',
        parameters: { packageName: 'com.example.app' },
        screenshotOnFailure: true,
      };

      mockAutomation.launchApp = jest.fn().mockImplementation(async () => {
        // Add a small delay to ensure duration > 0
        await new Promise(resolve => setTimeout(resolve, 1));
      });

      const result = await executor.executeStep(instruction, context);

      expect(result.status).toBe('success');
      expect(result.instructionId).toBe('step1');
      expect(result.duration).toBeGreaterThan(0);
      expect(mockAutomation.launchApp).toHaveBeenCalledWith('com.example.app');
    });

    it('should handle step failure with screenshot', async () => {
      const instruction: TestInstruction = {
        id: 'step1',
        action: 'TAP_ELEMENT',
        description: 'Tap element',
        selector: { type: 'id', value: 'button' },
        screenshotOnFailure: true,
      };

      mockAutomation.tapElement = jest
        .fn()
        .mockRejectedValue(new Error('Element not found'));
      mockAutomation.takeScreenshot = jest.fn().mockResolvedValue({
        base64: 'screenshot-data',
        width: 1080,
        height: 1920,
        timestamp: new Date(),
      });

      const result = await executor.executeStep(instruction, context);

      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('Element not found');
      expect(result.screenshot).toBe('screenshot-data');
      expect(mockAutomation.takeScreenshot).toHaveBeenCalled();
    });

    it('should handle screenshot failure gracefully', async () => {
      const instruction: TestInstruction = {
        id: 'step1',
        action: 'TAP_ELEMENT',
        description: 'Tap element',
        selector: { type: 'id', value: 'button' },
        screenshotOnFailure: true,
      };

      mockAutomation.tapElement = jest
        .fn()
        .mockRejectedValue(new Error('Element not found'));
      mockAutomation.takeScreenshot = jest
        .fn()
        .mockRejectedValue(new Error('Screenshot failed'));

      const result = await executor.executeStep(instruction, context);

      expect(result.status).toBe('failed');
      expect(result.screenshot).toBeUndefined();
    });
  });

  describe('action handlers', () => {
    describe('LAUNCH_APP', () => {
      it('should launch app with package name', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'LAUNCH_APP',
          description: 'Launch app',
          parameters: { packageName: 'com.example.app' },
          screenshotOnFailure: true,
        };

        mockAutomation.launchApp = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.launchApp).toHaveBeenCalledWith(
          'com.example.app'
        );
      });

      it('should throw error if package name missing', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'LAUNCH_APP',
          description: 'Launch app',
          screenshotOnFailure: true,
        };

        const result = await executor.executeStep(instruction, context);

        expect(result.status).toBe('failed');
        expect(result.error?.message).toContain(
          'LAUNCH_APP requires packageName parameter'
        );
      });
    });

    describe('TAP_ELEMENT', () => {
      it('should tap element with selector', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'TAP_ELEMENT',
          description: 'Tap element',
          selector: { type: 'id', value: 'button' },
          screenshotOnFailure: true,
        };

        mockAutomation.tapElement = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.tapElement).toHaveBeenCalledWith({
          type: 'id',
          value: 'button',
        });
      });

      it('should throw error if selector missing', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'TAP_ELEMENT',
          description: 'Tap element',
          screenshotOnFailure: true,
        };

        const result = await executor.executeStep(instruction, context);

        expect(result.status).toBe('failed');
        expect(result.error?.message).toContain(
          'TAP_ELEMENT requires a selector'
        );
      });
    });

    describe('TYPE_TEXT', () => {
      it('should type text', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'TYPE_TEXT',
          description: 'Type text',
          parameters: { text: 'hello world' },
          screenshotOnFailure: true,
        };

        mockAutomation.typeText = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.typeText).toHaveBeenCalledWith(
          'hello world',
          false
        );
      });

      it('should type text with submit', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'TYPE_TEXT',
          description: 'Type text',
          parameters: { text: 'hello world', submit: true },
          screenshotOnFailure: true,
        };

        mockAutomation.typeText = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.typeText).toHaveBeenCalledWith(
          'hello world',
          true
        );
      });

      it('should tap element first if selector provided', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'TYPE_TEXT',
          description: 'Type text',
          selector: { type: 'id', value: 'input' },
          parameters: { text: 'hello world' },
          screenshotOnFailure: true,
        };

        mockAutomation.tapElement = jest.fn().mockResolvedValue(undefined);
        mockAutomation.typeText = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.tapElement).toHaveBeenCalledWith({
          type: 'id',
          value: 'input',
        });
        expect(mockAutomation.typeText).toHaveBeenCalledWith(
          'hello world',
          false
        );
      });
    });

    describe('WAIT_FOR_ELEMENT', () => {
      it('should wait for element', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'WAIT_FOR_ELEMENT',
          description: 'Wait for element',
          selector: { type: 'id', value: 'loading' },
          screenshotOnFailure: true,
        };

        mockAutomation.waitForElement = jest.fn().mockResolvedValue({
          id: 'loading',
          bounds: { x: 0, y: 0, width: 50, height: 50 },
          visible: true,
          enabled: true,
        });

        await executor.executeStep(instruction, context);

        expect(mockAutomation.waitForElement).toHaveBeenCalledWith(
          { type: 'id', value: 'loading' },
          10000
        );
      });

      it('should use custom timeout', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'WAIT_FOR_ELEMENT',
          description: 'Wait for element',
          selector: { type: 'id', value: 'loading' },
          parameters: { timeout: 5000 },
          screenshotOnFailure: true,
        };

        mockAutomation.waitForElement = jest.fn().mockResolvedValue({
          id: 'loading',
          bounds: { x: 0, y: 0, width: 50, height: 50 },
          visible: true,
          enabled: true,
        });

        await executor.executeStep(instruction, context);

        expect(mockAutomation.waitForElement).toHaveBeenCalledWith(
          { type: 'id', value: 'loading' },
          5000
        );
      });
    });

    describe('SWIPE', () => {
      it('should swipe in direction', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'SWIPE',
          description: 'Swipe up',
          parameters: { direction: 'up' },
          screenshotOnFailure: true,
        };

        mockAutomation.swipe = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.swipe).toHaveBeenCalledWith('up');
      });

      it('should throw error for invalid direction', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'SWIPE',
          description: 'Swipe invalid',
          parameters: { direction: 'invalid' },
          screenshotOnFailure: true,
        };

        const result = await executor.executeStep(instruction, context);

        expect(result.status).toBe('failed');
        expect(result.error?.message).toContain(
          'SWIPE requires valid direction parameter'
        );
      });
    });

    describe('PRESS_BACK and PRESS_HOME', () => {
      it('should press back button', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'PRESS_BACK',
          description: 'Press back',
          screenshotOnFailure: true,
        };

        mockAutomation.pressButton = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.pressButton).toHaveBeenCalledWith('BACK');
      });

      it('should press home button', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'PRESS_HOME',
          description: 'Press home',
          screenshotOnFailure: true,
        };

        mockAutomation.pressButton = jest.fn().mockResolvedValue(undefined);

        await executor.executeStep(instruction, context);

        expect(mockAutomation.pressButton).toHaveBeenCalledWith('HOME');
      });
    });

    describe('ASSERT_VISIBLE and ASSERT_NOT_VISIBLE', () => {
      it('should assert element is visible', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'ASSERT_VISIBLE',
          description: 'Assert visible',
          selector: { type: 'id', value: 'element' },
          screenshotOnFailure: true,
        };

        mockAutomation.findElement = jest.fn().mockResolvedValue({
          id: 'element',
          bounds: { x: 0, y: 0, width: 50, height: 50 },
          visible: true,
          enabled: true,
        });

        await executor.executeStep(instruction, context);

        expect(mockAutomation.findElement).toHaveBeenCalledWith({
          type: 'id',
          value: 'element',
        });
      });

      it('should fail if element is not visible', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'ASSERT_VISIBLE',
          description: 'Assert visible',
          selector: { type: 'id', value: 'element' },
          screenshotOnFailure: true,
        };

        mockAutomation.findElement = jest.fn().mockResolvedValue({
          id: 'element',
          bounds: { x: 0, y: 0, width: 50, height: 50 },
          visible: false,
          enabled: true,
        });

        const result = await executor.executeStep(instruction, context);

        expect(result.status).toBe('failed');
        expect(result.error?.message).toContain('Element is not visible');
      });

      it('should assert element is not visible when element not found', async () => {
        const instruction: TestInstruction = {
          id: 'step1',
          action: 'ASSERT_NOT_VISIBLE',
          description: 'Assert not visible',
          selector: { type: 'id', value: 'element' },
          screenshotOnFailure: true,
        };

        mockAutomation.findElement = jest
          .fn()
          .mockRejectedValue(new Error('Element not found'));

        const result = await executor.executeStep(instruction, context);

        expect(result.status).toBe('success');
      });
    });
  });

  describe('retry logic', () => {
    it('should retry failed instructions', async () => {
      const instruction: TestInstruction = {
        id: 'step1',
        action: 'TAP_ELEMENT',
        description: 'Tap element',
        selector: { type: 'id', value: 'button' },
        retryCount: 2,
        screenshotOnFailure: true,
      };

      mockAutomation.tapElement = jest
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce(undefined);

      const result = await executor.executeStep(instruction, context);

      expect(result.status).toBe('success');
      expect(mockAutomation.tapElement).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const instruction: TestInstruction = {
        id: 'step1',
        action: 'TAP_ELEMENT',
        description: 'Tap element',
        selector: { type: 'id', value: 'button' },
        retryCount: 1,
        screenshotOnFailure: true,
      };

      mockAutomation.tapElement = jest
        .fn()
        .mockRejectedValue(new Error('Always fails'));

      const result = await executor.executeStep(instruction, context);

      expect(result.status).toBe('failed');
      expect(mockAutomation.tapElement).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running instructions', async () => {
      const instruction: TestInstruction = {
        id: 'step1',
        action: 'TAP_ELEMENT',
        description: 'Tap element',
        selector: { type: 'id', value: 'button' },
        timeout: 100, // Very short timeout
        screenshotOnFailure: true,
      };

      mockAutomation.tapElement = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200)) // Takes longer than timeout
      );

      const result = await executor.executeStep(instruction, context);

      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain(
        'Instruction timeout after 100ms'
      );
    });
  });
});
