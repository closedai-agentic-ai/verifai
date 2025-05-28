/**
 * Test Instruction Parser
 * Parses natural language test instructions into structured TestInstruction objects
 */

import {
  TestInstruction,
  TestActionType,
  ElementSelector,
  SelectorType,
} from '../../types';
import logger from '../../utils/logger';

/**
 * Parsing result with validation information
 */
export interface ParseResult {
  instructions: TestInstruction[];
  warnings: string[];
  errors: string[];
  totalInstructions: number;
  validInstructions: number;
}

/**
 * Instruction parsing patterns
 */
interface InstructionPattern {
  pattern: RegExp;
  action: TestActionType;
  extractParams: (match: RegExpMatchArray) => {
    selector?: ElementSelector;
    parameters?: Record<string, any>;
    description?: string;
  };
}

/**
 * Test Instruction Parser
 */
export class TestInstructionParser {
  private patterns: InstructionPattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Parse test instructions from text
   */
  public parseInstructions(text: string): ParseResult {
    logger.info('Parsing test instructions', {
      event: 'instruction_parse_start',
      textLength: text.length,
      timestamp: new Date().toISOString(),
    });

    const result: ParseResult = {
      instructions: [],
      warnings: [],
      errors: [],
      totalInstructions: 0,
      validInstructions: 0,
    };

    try {
      // Split text into lines and filter out empty lines
      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(
          line =>
            line.length > 0 && !line.startsWith('#') && !line.startsWith('//')
        );

      result.totalInstructions = lines.length;

      // Parse each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Skip if line is undefined or empty
        if (!line) {
          continue;
        }

        try {
          const instruction = this.parseSingleInstruction(line, lineNumber);
          if (instruction) {
            result.instructions.push(instruction);
            result.validInstructions++;
          } else {
            result.warnings.push(
              `Line ${lineNumber}: Could not parse instruction: "${line}"`
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Line ${lineNumber}: ${errorMessage}`);
        }
      }

      logger.info('Instruction parsing completed', {
        event: 'instruction_parse_complete',
        totalInstructions: result.totalInstructions,
        validInstructions: result.validInstructions,
        warnings: result.warnings.length,
        errors: result.errors.length,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Instruction parsing failed', {
        event: 'instruction_parse_error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      result.errors.push(`Parsing failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Parse a single instruction line
   */
  private parseSingleInstruction(
    line: string,
    lineNumber: number
  ): TestInstruction | null {
    // Try each pattern until one matches
    for (const pattern of this.patterns) {
      const match = line.match(pattern.pattern);
      if (match) {
        try {
          const { selector, parameters, description } =
            pattern.extractParams(match);

          const instruction: TestInstruction = {
            id: `step_${lineNumber}`,
            action: pattern.action,
            description: description || line,
            screenshotOnFailure: true,
          };

          // Add optional properties only if they exist
          if (selector) {
            instruction.selector = selector;
          }
          if (parameters) {
            instruction.parameters = parameters;
          }

          const timeout = this.extractTimeout(line);
          if (timeout !== undefined) {
            instruction.timeout = timeout;
          }

          const retryCount = this.extractRetryCount(line);
          if (retryCount !== undefined) {
            instruction.retryCount = retryCount;
          }

          // Validate the instruction
          this.validateInstruction(instruction);

          return instruction;
        } catch (error) {
          throw new Error(
            `Failed to parse instruction: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    return null;
  }

  /**
   * Initialize instruction parsing patterns
   */
  private initializePatterns(): void {
    this.patterns = [
      // Launch app
      {
        pattern:
          /^(?:launch|open|start)\s+(?:app\s+)?(?:with\s+package\s+)?["`']?([a-z][a-z0-9_.]*)["`']?$/i,
        action: 'LAUNCH_APP',
        extractParams: match => ({
          parameters: { packageName: match[1] || '' },
          description: `Launch app with package: ${match[1] || 'unknown'}`,
        }),
      },

      // Tap element by ID
      {
        pattern:
          /^(?:tap|click|touch)\s+(?:on\s+)?(?:element\s+)?(?:with\s+)?id\s+["`']([^"`']+)["`']$/i,
        action: 'TAP_ELEMENT',
        extractParams: match => ({
          selector: { type: 'id' as SelectorType, value: match[1] || '' },
          description: `Tap element with ID: ${match[1] || 'unknown'}`,
        }),
      },

      // Tap element by text
      {
        pattern:
          /^(?:tap|click|touch)\s+(?:on\s+)?(?:element\s+)?(?:with\s+)?text\s+["`']([^"`']+)["`']$/i,
        action: 'TAP_ELEMENT',
        extractParams: match => ({
          selector: { type: 'text' as SelectorType, value: match[1] || '' },
          description: `Tap element with text: ${match[1] || 'unknown'}`,
        }),
      },

      // Tap element by class
      {
        pattern:
          /^(?:tap|click|touch)\s+(?:on\s+)?(?:element\s+)?(?:with\s+)?class\s+["`']([^"`']+)["`']$/i,
        action: 'TAP_ELEMENT',
        extractParams: match => ({
          selector: { type: 'class' as SelectorType, value: match[1] || '' },
          description: `Tap element with class: ${match[1] || 'unknown'}`,
        }),
      },

      // Type text
      {
        pattern:
          /^(?:type|enter|input)\s+["`']([^"`']+)["`'](?:\s+(?:into|in)\s+(?:element\s+)?(?:with\s+)?(?:id|text|class)\s+["`']([^"`']+)["`'])?$/i,
        action: 'TYPE_TEXT',
        extractParams: match => {
          const params: any = { text: match[1] || '' };
          const result: {
            selector?: ElementSelector;
            parameters?: Record<string, any>;
            description?: string;
          } = {
            parameters: params,
            description: `Type text: ${match[1] || 'unknown'}${match[2] ? ` into element: ${match[2]}` : ''}`,
          };

          if (match[2]) {
            // Determine selector type based on context
            const selectorValue = match[2];
            result.selector = {
              type: 'id' as SelectorType,
              value: selectorValue,
            };
          }

          return result;
        },
      },

      // Wait for element
      {
        pattern:
          /^wait\s+for\s+(?:element\s+)?(?:with\s+)?(id|text|class)\s+["`']([^"`']+)["`'](?:\s+(?:for\s+)?(\d+)\s*(?:seconds?|ms|milliseconds?))?$/i,
        action: 'WAIT_FOR_ELEMENT',
        extractParams: match => ({
          selector: {
            type: (match[1] || 'id') as SelectorType,
            value: match[2] || '',
          },
          parameters: {
            timeout: match[3] ? parseInt(match[3], 10) * 1000 : 10000,
          },
          description: `Wait for element with ${match[1] || 'id'}: ${match[2] || 'unknown'}`,
        }),
      },

      // Verify text
      {
        pattern:
          /^(?:verify|check|assert)\s+(?:that\s+)?text\s+["`']([^"`']+)["`']\s+(?:is\s+)?(?:visible|present|displayed)$/i,
        action: 'VERIFY_TEXT',
        extractParams: match => ({
          parameters: { expectedText: match[1] || '' },
          description: `Verify text is visible: ${match[1] || 'unknown'}`,
        }),
      },

      // Verify element visible
      {
        pattern:
          /^(?:verify|check|assert)\s+(?:that\s+)?(?:element\s+)?(?:with\s+)?(id|text|class)\s+["`']([^"`']+)["`']\s+(?:is\s+)?(?:visible|present|displayed)$/i,
        action: 'ASSERT_VISIBLE',
        extractParams: match => ({
          selector: {
            type: (match[1] || 'id') as SelectorType,
            value: match[2] || '',
          },
          description: `Verify element is visible with ${match[1] || 'id'}: ${match[2] || 'unknown'}`,
        }),
      },

      // Verify element not visible
      {
        pattern:
          /^(?:verify|check|assert)\s+(?:that\s+)?(?:element\s+)?(?:with\s+)?(id|text|class)\s+["`']([^"`']+)["`']\s+(?:is\s+)?(?:not\s+)?(?:visible|present|displayed)$/i,
        action: 'ASSERT_NOT_VISIBLE',
        extractParams: match => ({
          selector: {
            type: (match[1] || 'id') as SelectorType,
            value: match[2] || '',
          },
          description: `Verify element is not visible with ${match[1] || 'id'}: ${match[2] || 'unknown'}`,
        }),
      },

      // Take screenshot
      {
        pattern:
          /^(?:take|capture)\s+(?:a\s+)?screenshot(?:\s+(?:named|as)\s+["`']([^"`']+)["`'])?$/i,
        action: 'TAKE_SCREENSHOT',
        extractParams: match => ({
          parameters: { name: match[1] || `screenshot_${Date.now()}` },
          description: `Take screenshot${match[1] ? `: ${match[1]}` : ''}`,
        }),
      },

      // Scroll
      {
        pattern: /^scroll\s+(up|down)(?:\s+(\d+)\s*(?:times|pixels?))?$/i,
        action: 'SCROLL',
        extractParams: match => ({
          parameters: {
            direction: (match[1] || 'down').toLowerCase(),
            amount: match[2] ? parseInt(match[2], 10) : 1,
          },
          description: `Scroll ${match[1] || 'down'}${match[2] ? ` ${match[2]} times` : ''}`,
        }),
      },

      // Swipe
      {
        pattern: /^swipe\s+(up|down|left|right)$/i,
        action: 'SWIPE',
        extractParams: match => ({
          parameters: { direction: (match[1] || 'up').toLowerCase() },
          description: `Swipe ${match[1] || 'up'}`,
        }),
      },

      // Press back button
      {
        pattern: /^(?:press|tap)\s+(?:the\s+)?back\s+(?:button)?$/i,
        action: 'PRESS_BACK',
        extractParams: () => ({
          description: 'Press back button',
        }),
      },

      // Press home button
      {
        pattern: /^(?:press|tap)\s+(?:the\s+)?home\s+(?:button)?$/i,
        action: 'PRESS_HOME',
        extractParams: () => ({
          description: 'Press home button',
        }),
      },
    ];
  }

  /**
   * Extract timeout from instruction line
   */
  private extractTimeout(line: string): number | undefined {
    const timeoutMatch = line.match(
      /timeout\s+(\d+)\s*(?:seconds?|ms|milliseconds?)/i
    );
    if (timeoutMatch && timeoutMatch[1]) {
      const value = parseInt(timeoutMatch[1], 10);
      const unit = timeoutMatch[0].toLowerCase();
      return unit.includes('ms') || unit.includes('millisecond')
        ? value
        : value * 1000;
    }
    return undefined;
  }

  /**
   * Extract retry count from instruction line
   */
  private extractRetryCount(line: string): number | undefined {
    const retryMatch = line.match(/retry\s+(\d+)\s*(?:times?)/i);
    return retryMatch && retryMatch[1]
      ? parseInt(retryMatch[1], 10)
      : undefined;
  }

  /**
   * Validate parsed instruction
   */
  private validateInstruction(instruction: TestInstruction): void {
    // Check if action requires selector
    const actionsRequiringSelector: TestActionType[] = [
      'TAP_ELEMENT',
      'WAIT_FOR_ELEMENT',
      'VERIFY_ELEMENT_COUNT',
      'ASSERT_VISIBLE',
      'ASSERT_NOT_VISIBLE',
    ];

    if (
      actionsRequiringSelector.includes(instruction.action) &&
      !instruction.selector
    ) {
      throw new Error(`Action ${instruction.action} requires a selector`);
    }

    // Check if action requires parameters
    const actionsRequiringParameters: TestActionType[] = [
      'LAUNCH_APP',
      'TYPE_TEXT',
      'VERIFY_TEXT',
    ];

    if (
      actionsRequiringParameters.includes(instruction.action) &&
      !instruction.parameters
    ) {
      throw new Error(`Action ${instruction.action} requires parameters`);
    }

    // Validate selector if present
    if (instruction.selector) {
      if (!instruction.selector.type || !instruction.selector.value) {
        throw new Error('Selector must have both type and value');
      }

      const validSelectorTypes: SelectorType[] = [
        'id',
        'xpath',
        'text',
        'class',
        'accessibility',
      ];
      if (!validSelectorTypes.includes(instruction.selector.type)) {
        throw new Error(`Invalid selector type: ${instruction.selector.type}`);
      }
    }

    // Validate timeout
    if (instruction.timeout !== undefined && instruction.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }

    // Validate retry count
    if (
      instruction.retryCount !== undefined &&
      (instruction.retryCount < 0 || instruction.retryCount > 5)
    ) {
      throw new Error('Retry count must be between 0 and 5');
    }
  }

  /**
   * Get supported instruction patterns for documentation
   */
  public getSupportedPatterns(): string[] {
    return [
      'launch app "com.example.app"',
      'tap element with id "button_login"',
      'tap element with text "Login"',
      'tap element with class "android.widget.Button"',
      'type "username" into element with id "input_username"',
      'wait for element with id "loading_spinner"',
      'verify text "Welcome" is visible',
      'verify element with id "success_message" is visible',
      'verify element with id "error_message" is not visible',
      'take screenshot',
      'take screenshot named "login_screen"',
      'scroll down',
      'scroll up 3 times',
      'swipe up',
      'press back button',
      'press home button',
    ];
  }
}

export default TestInstructionParser;
