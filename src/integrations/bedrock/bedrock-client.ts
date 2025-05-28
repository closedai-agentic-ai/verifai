/**
 * AWS Bedrock Client
 * Handles AI-powered instruction analysis and natural language processing
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockConfig,
  InstructionAnalysis,
  TestInstruction,
} from '../../types';
import logger from '../../utils/logger';

/**
 * Instruction analysis prompt template
 */
interface AnalysisPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * BedrockClient class for AI-powered instruction analysis
 */
export class BedrockClient {
  private client: BedrockRuntimeClient;
  private config: BedrockConfig;

  constructor(config: BedrockConfig) {
    this.config = {
      ...config,
      modelId: config.modelId || 'anthropic.claude-3-sonnet-20240229-v1:0',
      region: config.region || 'us-east-1',
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.1,
      topP: config.topP || 0.9,
    };

    // Initialize Bedrock Runtime client
    this.client = new BedrockRuntimeClient({
      region: this.config.region,
      // AWS credentials will be automatically loaded from environment variables
      // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
    });

    logger.info('BedrockClient initialized', {
      event: 'bedrock_client_init',
      modelId: this.config.modelId,
      region: this.config.region,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Analyze natural language test instructions and convert to structured format
   */
  public async analyzeInstructions(
    naturalLanguageText: string
  ): Promise<InstructionAnalysis> {
    const startTime = Date.now();

    try {
      logger.info('Starting instruction analysis', {
        event: 'instruction_analysis_start',
        textLength: naturalLanguageText.length,
        timestamp: new Date().toISOString(),
      });

      const prompt = this.buildAnalysisPrompt(naturalLanguageText);
      const response = await this.invokeModel(prompt);
      const analysis = this.parseAnalysisResponse(
        response,
        naturalLanguageText
      );

      const duration = Date.now() - startTime;

      logger.info('Instruction analysis completed', {
        event: 'instruction_analysis_complete',
        duration,
        instructionCount: analysis.parsedInstructions.length,
        confidence: analysis.confidence,
        warningCount: analysis.warnings.length,
        timestamp: new Date().toISOString(),
      });

      return analysis;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Instruction analysis failed', {
        event: 'instruction_analysis_error',
        error: errorMessage,
        duration,
        textLength: naturalLanguageText.length,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Bedrock instruction analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Validate parsed instructions for correctness and completeness
   */
  public async validateInstructions(instructions: TestInstruction[]): Promise<{
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  }> {
    const startTime = Date.now();

    try {
      logger.info('Starting instruction validation', {
        event: 'instruction_validation_start',
        instructionCount: instructions.length,
        timestamp: new Date().toISOString(),
      });

      const prompt = this.buildValidationPrompt(instructions);
      const response = await this.invokeModel(prompt);
      const validation = this.parseValidationResponse(response);

      const duration = Date.now() - startTime;

      logger.info('Instruction validation completed', {
        event: 'instruction_validation_complete',
        duration,
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        suggestionCount: validation.suggestions.length,
        timestamp: new Date().toISOString(),
      });

      return validation;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Instruction validation failed', {
        event: 'instruction_validation_error',
        error: errorMessage,
        duration,
        instructionCount: instructions.length,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Bedrock instruction validation failed: ${errorMessage}`);
    }
  }

  /**
   * Generate test suggestions based on app analysis
   */
  public async generateTestSuggestions(
    appDescription: string,
    existingInstructions?: TestInstruction[]
  ): Promise<{
    suggestions: TestInstruction[];
    reasoning: string;
    coverage: string[];
  }> {
    const startTime = Date.now();

    try {
      logger.info('Starting test suggestion generation', {
        event: 'test_suggestion_start',
        appDescriptionLength: appDescription.length,
        existingInstructionCount: existingInstructions?.length || 0,
        timestamp: new Date().toISOString(),
      });

      const prompt = this.buildSuggestionPrompt(
        appDescription,
        existingInstructions
      );
      const response = await this.invokeModel(prompt);
      const suggestions = this.parseSuggestionResponse(response);

      const duration = Date.now() - startTime;

      logger.info('Test suggestion generation completed', {
        event: 'test_suggestion_complete',
        duration,
        suggestionCount: suggestions.suggestions.length,
        coverageAreas: suggestions.coverage.length,
        timestamp: new Date().toISOString(),
      });

      return suggestions;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Test suggestion generation failed', {
        event: 'test_suggestion_error',
        error: errorMessage,
        duration,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Bedrock test suggestion failed: ${errorMessage}`);
    }
  }

  /**
   * Check Bedrock service health
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Simple health check with minimal prompt
      const testPrompt = this.buildHealthCheckPrompt();
      await this.invokeModel(testPrompt);

      const responseTime = Date.now() - startTime;

      logger.debug('Bedrock health check passed', {
        event: 'bedrock_health_check',
        responseTime,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.warn('Bedrock health check failed', {
        event: 'bedrock_health_check_error',
        error: errorMessage,
        responseTime,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 'unhealthy',
        responseTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Invoke Bedrock model with prompt
   */
  private async invokeModel(prompt: AnalysisPrompt): Promise<string> {
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      system: prompt.systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt.userPrompt,
        },
      ],
    };

    const input: InvokeModelCommandInput = {
      modelId: this.config.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    };

    logger.debug('Invoking Bedrock model', {
      event: 'bedrock_model_invoke',
      modelId: this.config.modelId,
      promptLength: prompt.userPrompt.length,
      maxTokens: this.config.maxTokens,
      timestamp: new Date().toISOString(),
    });

    const command = new InvokeModelCommand(input);
    const response: InvokeModelCommandOutput = await this.client.send(command);

    if (!response.body) {
      throw new Error('Empty response body from Bedrock');
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (!responseBody.content || !responseBody.content[0]?.text) {
      throw new Error('Invalid response format from Bedrock');
    }

    return responseBody.content[0].text;
  }

  /**
   * Build instruction analysis prompt
   */
  private buildAnalysisPrompt(naturalLanguageText: string): AnalysisPrompt {
    const systemPrompt = `You are an expert mobile app testing assistant. Your task is to analyze natural language test instructions and convert them into structured, executable test steps for Android mobile automation.

SUPPORTED ACTIONS:
- LAUNCH_APP: Launch an application
- TAP_ELEMENT: Tap on a UI element
- TYPE_TEXT: Type text into an input field
- WAIT_FOR_ELEMENT: Wait for an element to appear
- VERIFY_ELEMENT_COUNT: Verify the count of elements
- VERIFY_TEXT: Verify text content
- TAKE_SCREENSHOT: Take a screenshot
- SCROLL: Scroll in a direction
- SWIPE: Swipe gesture
- PRESS_BACK: Press back button
- PRESS_HOME: Press home button
- ASSERT_VISIBLE: Assert element is visible
- ASSERT_NOT_VISIBLE: Assert element is not visible

SELECTOR TYPES:
- id: Element ID
- xpath: XPath expression
- text: Visible text content
- class: CSS class name
- accessibility: Accessibility label

Return your response as a JSON object with this exact structure:
{
  "instructions": [
    {
      "id": "step_1",
      "action": "ACTION_TYPE",
      "selector": {
        "type": "selector_type",
        "value": "selector_value",
        "timeout": 5000
      },
      "parameters": {
        "text": "text_to_type",
        "count": 1,
        "direction": "down"
      },
      "description": "Human readable description",
      "timeout": 10000,
      "retryCount": 3,
      "screenshotOnFailure": true
    }
  ],
  "confidence": 0.95,
  "warnings": ["Any warnings about ambiguous instructions"],
  "suggestions": ["Suggestions for improvement"]
}`;

    const userPrompt = `Please analyze the following natural language test instructions and convert them to structured test steps:

${naturalLanguageText}

Ensure each step is clear, executable, and includes appropriate selectors and parameters. If any instruction is ambiguous, include warnings and suggestions for clarification.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Build instruction validation prompt
   */
  private buildValidationPrompt(
    instructions: TestInstruction[]
  ): AnalysisPrompt {
    const systemPrompt = `You are an expert mobile app testing validator. Your task is to review structured test instructions for correctness, completeness, and best practices.

Check for:
1. Valid action types and parameters
2. Proper selector formats
3. Logical flow and dependencies
4. Missing error handling
5. Performance considerations
6. Best practices compliance

Return your response as a JSON object:
{
  "isValid": true/false,
  "errors": ["List of errors that must be fixed"],
  "suggestions": ["List of suggestions for improvement"]
}`;

    const userPrompt = `Please validate the following test instructions:

${JSON.stringify(instructions, null, 2)}

Identify any errors that would prevent execution and provide suggestions for improvement.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Build test suggestion prompt
   */
  private buildSuggestionPrompt(
    appDescription: string,
    existingInstructions?: TestInstruction[]
  ): AnalysisPrompt {
    const systemPrompt = `You are an expert mobile app testing strategist. Your task is to generate comprehensive test suggestions based on app description and existing test coverage.

Focus on:
1. Core functionality testing
2. User journey validation
3. Edge cases and error scenarios
4. Performance considerations
5. Accessibility testing
6. Security considerations

Return your response as a JSON object:
{
  "suggestions": [
    {
      "id": "suggested_step_1",
      "action": "ACTION_TYPE",
      "selector": {...},
      "parameters": {...},
      "description": "Description",
      "timeout": 10000,
      "retryCount": 3,
      "screenshotOnFailure": true
    }
  ],
  "reasoning": "Explanation of why these tests are important",
  "coverage": ["List of areas covered by suggestions"]
}`;

    const existingText = existingInstructions
      ? `\n\nExisting test instructions:\n${JSON.stringify(existingInstructions, null, 2)}`
      : '';

    const userPrompt = `Please generate test suggestions for the following app:

App Description:
${appDescription}${existingText}

Generate comprehensive test suggestions that complement existing tests and ensure good coverage.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Build health check prompt
   */
  private buildHealthCheckPrompt(): AnalysisPrompt {
    const systemPrompt =
      'You are a helpful assistant. Respond with a simple confirmation.';
    const userPrompt =
      'Please respond with "OK" to confirm the service is working.';

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse instruction analysis response
   */
  private parseAnalysisResponse(
    response: string,
    originalText: string
  ): InstructionAnalysis {
    try {
      const parsed = JSON.parse(response);

      return {
        originalText,
        parsedInstructions: parsed.instructions || [],
        confidence: parsed.confidence || 0.5,
        warnings: parsed.warnings || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      logger.warn('Failed to parse Bedrock analysis response', {
        event: 'bedrock_parse_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        response: response.substring(0, 500),
        timestamp: new Date().toISOString(),
      });

      return {
        originalText,
        parsedInstructions: [],
        confidence: 0,
        warnings: ['Failed to parse AI response'],
        suggestions: ['Please provide clearer instructions'],
      };
    }
  }

  /**
   * Parse validation response
   */
  private parseValidationResponse(response: string): {
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  } {
    try {
      const parsed = JSON.parse(response);

      return {
        isValid: parsed.isValid || false,
        errors: parsed.errors || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      logger.warn('Failed to parse Bedrock validation response', {
        event: 'bedrock_validation_parse_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        response: response.substring(0, 500),
        timestamp: new Date().toISOString(),
      });

      return {
        isValid: false,
        errors: ['Failed to parse validation response'],
        suggestions: ['Please retry validation'],
      };
    }
  }

  /**
   * Parse suggestion response
   */
  private parseSuggestionResponse(response: string): {
    suggestions: TestInstruction[];
    reasoning: string;
    coverage: string[];
  } {
    try {
      const parsed = JSON.parse(response);

      return {
        suggestions: parsed.suggestions || [],
        reasoning: parsed.reasoning || 'No reasoning provided',
        coverage: parsed.coverage || [],
      };
    } catch (error) {
      logger.warn('Failed to parse Bedrock suggestion response', {
        event: 'bedrock_suggestion_parse_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        response: response.substring(0, 500),
        timestamp: new Date().toISOString(),
      });

      return {
        suggestions: [],
        reasoning: 'Failed to parse suggestion response',
        coverage: [],
      };
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): BedrockConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<BedrockConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.info('BedrockClient configuration updated', {
      event: 'bedrock_config_update',
      newConfig,
      timestamp: new Date().toISOString(),
    });
  }
}
