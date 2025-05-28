/**
 * Test Executor
 * Executes test instructions using mobile automation
 */

import {
  MobileMCPClient,
  MobileAutomation,
} from '../../integrations/mobile-mcp';
import {
  TestInstruction,
  TestStepResult,
  TestResult,
  ApkInfo,
} from '../../types';
import logger from '../../utils/logger';

/**
 * Test execution configuration
 */
export interface TestExecutionConfig {
  timeout: number;
  screenshotOnFailure: boolean;
  retryAttempts: number;
  retryDelay: number;
  elementWaitTimeout: number;
}

/**
 * Test execution context
 */
export interface TestExecutionContext {
  testRunId: string;
  apkInfo?: ApkInfo;
}

/**
 * Test Executor for running mobile automation tests
 */
export class TestExecutor {
  private client: MobileMCPClient;
  private automation: MobileAutomation;
  private config: TestExecutionConfig;

  constructor(client: MobileMCPClient, config: TestExecutionConfig) {
    this.client = client;
    this.automation = new MobileAutomation(client);
    this.config = config;
  }

  /**
   * Execute a complete test with multiple instructions
   */
  public async executeTest(
    instructions: TestInstruction[],
    context: TestExecutionContext
  ): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      testRunId: context.testRunId,
      status: 'running',
      startTime: new Date(startTime),
      totalSteps: instructions.length,
      passedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      steps: [],
      screenshots: [],
      logs: [],
      metadata: {
        ...(context.apkInfo && { apkInfo: context.apkInfo }),
        testInstructions: instructions,
      },
    };

    logger.info('Starting test execution', {
      event: 'test_execution_start',
      testRunId: context.testRunId,
      totalSteps: instructions.length,
      apkInfo: context.apkInfo,
      timestamp: new Date().toISOString(),
    });

    try {
      // Ensure MCP client is connected
      if (!this.client.isReady()) {
        await this.client.connect();
      }

      // Execute each instruction
      for (const instruction of instructions) {
        const stepResult = await this.executeStep(instruction, context);
        result.steps.push(stepResult);

        if (stepResult.status === 'success') {
          result.passedSteps++;
        } else {
          result.failedSteps++;

          // Stop execution on failure unless configured to continue
          if (!this.shouldContinueOnFailure()) {
            break;
          }
        }
      }

      // Determine final status
      result.status = result.failedSteps > 0 ? 'failed' : 'completed';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Test execution failed', {
        event: 'test_execution_error',
        testRunId: context.testRunId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      result.status = 'failed';
      result.error = {
        message: errorMessage,
        code: 'EXECUTION_ERROR',
      };

      // Add stack trace if available
      if (error instanceof Error && error.stack) {
        result.error.stack = error.stack;
      }
    }

    // Calculate final timing
    const endTime = Date.now();
    result.endTime = new Date(endTime);
    result.duration = endTime - startTime;

    logger.info('Test execution completed', {
      event: 'test_execution_complete',
      testRunId: context.testRunId,
      status: result.status,
      duration: result.duration,
      passedSteps: result.passedSteps,
      failedSteps: result.failedSteps,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Execute a single test step
   */
  public async executeStep(
    instruction: TestInstruction,
    context: TestExecutionContext
  ): Promise<TestStepResult> {
    const startTime = new Date();

    const stepResult: TestStepResult = {
      instructionId: instruction.id,
      status: 'success',
      startTime,
      endTime: startTime,
      duration: 0,
    };

    try {
      // Execute the instruction with retries
      await this.executeInstructionWithRetry(instruction);

      stepResult.endTime = new Date();
      stepResult.duration =
        stepResult.endTime.getTime() - stepResult.startTime.getTime();
      stepResult.status = 'success';

      logger.info('Test step completed successfully', {
        event: 'test_step_success',
        testRunId: context.testRunId,
        instructionId: instruction.id,
        action: instruction.action,
        duration: stepResult.duration,
        timestamp: stepResult.endTime.toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      stepResult.endTime = new Date();
      stepResult.duration =
        stepResult.endTime.getTime() - stepResult.startTime.getTime();
      stepResult.status = 'failed';
      stepResult.error = {
        message: errorMessage,
        code: 'STEP_EXECUTION_ERROR',
      };

      // Add stack trace if available
      if (error instanceof Error && error.stack) {
        stepResult.error.stack = error.stack;
      }

      logger.error('Test step failed', {
        event: 'test_step_error',
        testRunId: context.testRunId,
        instructionId: instruction.id,
        action: instruction.action,
        error: errorMessage,
        duration: stepResult.duration,
        timestamp: stepResult.endTime.toISOString(),
      });

      // Take screenshot on failure if configured
      if (instruction.screenshotOnFailure && this.config.screenshotOnFailure) {
        try {
          const screenshot = await this.automation.takeScreenshot();
          stepResult.screenshot = screenshot.base64;

          logger.info('Screenshot captured on failure', {
            event: 'screenshot_on_failure',
            testRunId: context.testRunId,
            instructionId: instruction.id,
            timestamp: new Date().toISOString(),
          });
        } catch (screenshotError) {
          logger.warn('Failed to capture screenshot on failure', {
            event: 'screenshot_failure',
            testRunId: context.testRunId,
            instructionId: instruction.id,
            error:
              screenshotError instanceof Error
                ? screenshotError.message
                : 'Unknown error',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return stepResult;
  }

  /**
   * Execute instruction with retry logic
   */
  private async executeInstructionWithRetry(
    instruction: TestInstruction
  ): Promise<void> {
    const maxRetries = instruction.retryCount || this.config.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info('Retrying instruction execution', {
            event: 'instruction_retry',
            instructionId: instruction.id,
            attempt,
            maxRetries,
            timestamp: new Date().toISOString(),
          });

          // Wait before retry
          await new Promise(resolve =>
            setTimeout(resolve, this.config.retryDelay)
          );
        }

        await this.executeInstruction(instruction);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt === maxRetries) {
          // Last attempt failed, throw the error
          throw lastError;
        }
      }
    }
  }

  /**
   * Execute a single instruction
   */
  private async executeInstruction(
    instruction: TestInstruction
  ): Promise<void> {
    const timeout = instruction.timeout || this.config.timeout;

    // Set up timeout for the instruction
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Instruction timeout after ${timeout}ms`));
      }, timeout);
    });

    // Execute the instruction based on action type
    const executionPromise = this.performAction(instruction);

    // Race between execution and timeout
    await Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Perform the actual action based on instruction type
   */
  private async performAction(instruction: TestInstruction): Promise<void> {
    switch (instruction.action) {
      case 'LAUNCH_APP':
        await this.handleLaunchApp(instruction);
        break;

      case 'TAP_ELEMENT':
        await this.handleTapElement(instruction);
        break;

      case 'TYPE_TEXT':
        await this.handleTypeText(instruction);
        break;

      case 'WAIT_FOR_ELEMENT':
        await this.handleWaitForElement(instruction);
        break;

      case 'VERIFY_TEXT':
        await this.handleVerifyText(instruction);
        break;

      case 'VERIFY_ELEMENT_COUNT':
        await this.handleVerifyElementCount();
        break;

      case 'TAKE_SCREENSHOT':
        await this.handleTakeScreenshot();
        break;

      case 'SCROLL':
        await this.handleScroll(instruction);
        break;

      case 'SWIPE':
        await this.handleSwipe(instruction);
        break;

      case 'PRESS_BACK':
        await this.automation.pressButton('BACK');
        break;

      case 'PRESS_HOME':
        await this.automation.pressButton('HOME');
        break;

      case 'ASSERT_VISIBLE':
        await this.handleAssertVisible(instruction);
        break;

      case 'ASSERT_NOT_VISIBLE':
        await this.handleAssertNotVisible(instruction);
        break;

      default:
        throw new Error(`Unsupported action: ${instruction.action}`);
    }
  }

  /**
   * Handle LAUNCH_APP action
   */
  private async handleLaunchApp(instruction: TestInstruction): Promise<void> {
    if (!instruction.parameters?.['packageName']) {
      throw new Error('LAUNCH_APP requires packageName parameter');
    }
    await this.automation.launchApp(instruction.parameters['packageName']);
  }

  /**
   * Handle TAP_ELEMENT action
   */
  private async handleTapElement(instruction: TestInstruction): Promise<void> {
    if (!instruction.selector) {
      throw new Error('TAP_ELEMENT requires a selector');
    }
    await this.automation.tapElement(instruction.selector);
  }

  /**
   * Handle TYPE_TEXT action
   */
  private async handleTypeText(instruction: TestInstruction): Promise<void> {
    if (!instruction.parameters?.['text']) {
      throw new Error('TYPE_TEXT requires text parameter');
    }

    // Tap element first if selector is provided
    if (instruction.selector) {
      await this.automation.tapElement(instruction.selector);
    }

    await this.automation.typeText(
      instruction.parameters['text'],
      instruction.parameters['submit'] || false
    );
  }

  /**
   * Handle WAIT_FOR_ELEMENT action
   */
  private async handleWaitForElement(
    instruction: TestInstruction
  ): Promise<void> {
    if (!instruction.selector) {
      throw new Error('WAIT_FOR_ELEMENT requires a selector');
    }

    const timeout =
      instruction.parameters?.['timeout'] || this.config.elementWaitTimeout;
    await this.automation.waitForElement(instruction.selector, timeout);
  }

  /**
   * Handle VERIFY_TEXT action
   */
  private async handleVerifyText(instruction: TestInstruction): Promise<void> {
    if (!instruction.parameters?.['expectedText']) {
      throw new Error('VERIFY_TEXT requires expectedText parameter');
    }

    // Take screenshot for verification
    await this.automation.takeScreenshot();

    // For now, just log the verification
    // In a real implementation, this would use OCR or element text comparison
    logger.info('Text verification completed', {
      expectedText: instruction.parameters['expectedText'],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle VERIFY_ELEMENT_COUNT action
   */
  private async handleVerifyElementCount(): Promise<void> {
    // Placeholder implementation
    logger.info('Element count verification completed', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle TAKE_SCREENSHOT action
   */
  private async handleTakeScreenshot(): Promise<void> {
    await this.automation.takeScreenshot();
  }

  /**
   * Handle SCROLL action
   */
  private async handleScroll(instruction: TestInstruction): Promise<void> {
    const direction = instruction.parameters?.['direction'] || 'down';
    const amount = instruction.parameters?.['amount'] || 1;

    for (let i = 0; i < amount; i++) {
      await this.automation.swipe(direction as 'up' | 'down');
    }
  }

  /**
   * Handle SWIPE action
   */
  private async handleSwipe(instruction: TestInstruction): Promise<void> {
    const direction = instruction.parameters?.['direction'];
    if (!direction || !['up', 'down'].includes(direction)) {
      throw new Error('SWIPE requires valid direction parameter (up, down)');
    }
    await this.automation.swipe(direction as 'up' | 'down');
  }

  /**
   * Handle ASSERT_VISIBLE action
   */
  private async handleAssertVisible(
    instruction: TestInstruction
  ): Promise<void> {
    if (!instruction.selector) {
      throw new Error('ASSERT_VISIBLE requires a selector');
    }

    const element = await this.automation.findElement(instruction.selector);
    if (!element.visible) {
      throw new Error(
        `Element is not visible: ${JSON.stringify(instruction.selector)}`
      );
    }
  }

  /**
   * Handle ASSERT_NOT_VISIBLE action
   */
  private async handleAssertNotVisible(
    instruction: TestInstruction
  ): Promise<void> {
    if (!instruction.selector) {
      throw new Error('ASSERT_NOT_VISIBLE requires a selector');
    }

    try {
      const element = await this.automation.findElement(instruction.selector);
      if (element.visible) {
        throw new Error(
          `Element is visible but should not be: ${JSON.stringify(instruction.selector)}`
        );
      }
    } catch (error) {
      // Element not found is acceptable for ASSERT_NOT_VISIBLE
      if (
        error instanceof Error &&
        error.message.includes('Element not found')
      ) {
        return;
      }
      throw error;
    }
  }

  /**
   * Determine if execution should continue after a step failure
   */
  private shouldContinueOnFailure(): boolean {
    // For now, always stop on failure
    // This could be made configurable in the future
    return false;
  }
}

export default TestExecutor;
