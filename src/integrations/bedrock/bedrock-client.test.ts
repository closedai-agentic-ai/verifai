/**
 * Tests for BedrockClient
 */

import { BedrockClient } from './bedrock-client';
import { BedrockConfig, TestInstruction } from '../../types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('../../utils/logger');

describe('BedrockClient', () => {
  let bedrockClient: BedrockClient;
  let config: BedrockConfig;
  let mockSend: jest.Mock;

  beforeEach(() => {
    config = {
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      region: 'us-east-1',
      maxTokens: 4000,
      temperature: 0.1,
      topP: 0.9,
    };

    // Mock BedrockRuntimeClient
    mockSend = jest.fn();
    const MockBedrockRuntimeClient = jest.fn().mockImplementation(() => ({
      send: mockSend,
    }));

    require('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient =
      MockBedrockRuntimeClient;
    require('@aws-sdk/client-bedrock-runtime').InvokeModelCommand = jest.fn();

    bedrockClient = new BedrockClient(config);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(bedrockClient).toBeInstanceOf(BedrockClient);
    });

    it('should use default values for missing config', () => {
      const minimalConfig: BedrockConfig = {
        modelId: 'test-model',
        region: 'us-west-2',
      };

      const client = new BedrockClient(minimalConfig);
      expect(client).toBeInstanceOf(BedrockClient);
    });

    it('should get current configuration', () => {
      const currentConfig = bedrockClient.getConfig();
      expect(currentConfig.modelId).toBe(config.modelId);
      expect(currentConfig.region).toBe(config.region);
    });

    it('should update configuration', () => {
      const newConfig = { temperature: 0.5 };
      bedrockClient.updateConfig(newConfig);

      const updatedConfig = bedrockClient.getConfig();
      expect(updatedConfig.temperature).toBe(0.5);
    });
  });

  describe('analyzeInstructions', () => {
    it('should analyze natural language instructions successfully', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  instructions: [
                    {
                      id: 'step_1',
                      action: 'LAUNCH_APP',
                      parameters: { packageName: 'com.example.app' },
                      description: 'Launch the app',
                      timeout: 10000,
                      retryCount: 3,
                      screenshotOnFailure: true,
                    },
                  ],
                  confidence: 0.95,
                  warnings: [],
                  suggestions: [],
                }),
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const naturalLanguageText = 'Launch the example app';
      const result =
        await bedrockClient.analyzeInstructions(naturalLanguageText);

      expect(result.originalText).toBe(naturalLanguageText);
      expect(result.parsedInstructions).toHaveLength(1);
      expect(result.parsedInstructions[0]?.action).toBe('LAUNCH_APP');
      expect(result.confidence).toBe(0.95);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should handle malformed AI response gracefully', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: 'Invalid JSON response',
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result =
        await bedrockClient.analyzeInstructions('Test instruction');

      expect(result.parsedInstructions).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.warnings).toContain('Failed to parse AI response');
    });

    it('should handle AWS SDK errors', async () => {
      mockSend.mockRejectedValue(new Error('AWS SDK error'));

      await expect(
        bedrockClient.analyzeInstructions('Test instruction')
      ).rejects.toThrow('Bedrock instruction analysis failed');
    });

    it('should handle empty response body', async () => {
      const mockResponse = { body: null };
      mockSend.mockResolvedValue(mockResponse);

      await expect(
        bedrockClient.analyzeInstructions('Test instruction')
      ).rejects.toThrow('Empty response body from Bedrock');
    });

    it('should handle invalid response format', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            invalid: 'format',
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(
        bedrockClient.analyzeInstructions('Test instruction')
      ).rejects.toThrow('Invalid response format from Bedrock');
    });
  });

  describe('validateInstructions', () => {
    it('should validate instructions successfully', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  isValid: true,
                  errors: [],
                  suggestions: ['Consider adding more assertions'],
                }),
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const instructions: TestInstruction[] = [
        {
          id: 'step_1',
          action: 'LAUNCH_APP',
          parameters: { packageName: 'com.example.app' },
          description: 'Launch the app',
        },
      ];

      const result = await bedrockClient.validateInstructions(instructions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.suggestions).toHaveLength(1);
    });

    it('should handle validation with errors', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  isValid: false,
                  errors: ['Missing required selector'],
                  suggestions: ['Add proper element selector'],
                }),
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const instructions: TestInstruction[] = [
        {
          id: 'step_1',
          action: 'TAP_ELEMENT',
          description: 'Tap something',
        },
      ];

      const result = await bedrockClient.validateInstructions(instructions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required selector');
      expect(result.suggestions).toContain('Add proper element selector');
    });

    it('should handle validation parsing errors', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: 'Invalid validation response',
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await bedrockClient.validateInstructions([]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Failed to parse validation response');
    });

    it('should handle validation AWS errors', async () => {
      mockSend.mockRejectedValue(new Error('Validation failed'));

      await expect(bedrockClient.validateInstructions([])).rejects.toThrow(
        'Bedrock instruction validation failed'
      );
    });
  });

  describe('generateTestSuggestions', () => {
    it('should generate test suggestions successfully', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  suggestions: [
                    {
                      id: 'suggested_step_1',
                      action: 'VERIFY_TEXT',
                      selector: { type: 'text', value: 'Welcome' },
                      description: 'Verify welcome message',
                      timeout: 10000,
                      retryCount: 3,
                      screenshotOnFailure: true,
                    },
                  ],
                  reasoning:
                    'Testing welcome flow is important for user experience',
                  coverage: ['User onboarding', 'Welcome screen'],
                }),
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const appDescription = 'A simple todo app with user authentication';
      const result =
        await bedrockClient.generateTestSuggestions(appDescription);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]?.action).toBe('VERIFY_TEXT');
      expect(result.reasoning).toContain('user experience');
      expect(result.coverage).toContain('User onboarding');
    });

    it('should generate suggestions with existing instructions', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  suggestions: [
                    {
                      id: 'suggested_step_1',
                      action: 'ASSERT_VISIBLE',
                      selector: { type: 'id', value: 'logout_button' },
                      description: 'Verify logout button is visible',
                    },
                  ],
                  reasoning: 'Logout functionality should be tested',
                  coverage: ['Authentication', 'User session'],
                }),
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const appDescription = 'Todo app';
      const existingInstructions: TestInstruction[] = [
        {
          id: 'step_1',
          action: 'LAUNCH_APP',
          description: 'Launch app',
        },
      ];

      const result = await bedrockClient.generateTestSuggestions(
        appDescription,
        existingInstructions
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.coverage).toContain('Authentication');
    });

    it('should handle suggestion parsing errors', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: 'Invalid suggestion response',
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await bedrockClient.generateTestSuggestions('Test app');

      expect(result.suggestions).toHaveLength(0);
      expect(result.reasoning).toBe('Failed to parse suggestion response');
      expect(result.coverage).toHaveLength(0);
    });

    it('should handle suggestion AWS errors', async () => {
      mockSend.mockRejectedValue(new Error('Suggestion failed'));

      await expect(
        bedrockClient.generateTestSuggestions('Test app')
      ).rejects.toThrow('Bedrock test suggestion failed');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when service is available', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: 'OK',
              },
            ],
          })
        ),
      };

      // Add a small delay to ensure response time > 0
      mockSend.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 1))
      );

      const result = await bedrockClient.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status when service fails', async () => {
      // Add a small delay to ensure response time > 0
      mockSend.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Service unavailable')), 1)
          )
      );

      const result = await bedrockClient.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Service unavailable');
    });

    it('should handle timeout errors', async () => {
      mockSend.mockRejectedValue(new Error('Request timeout'));

      const result = await bedrockClient.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Request timeout');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      await expect(bedrockClient.analyzeInstructions('Test')).rejects.toThrow(
        'Bedrock instruction analysis failed: Network error'
      );
    });

    it('should handle authentication errors', async () => {
      mockSend.mockRejectedValue(new Error('Authentication failed'));

      await expect(bedrockClient.validateInstructions([])).rejects.toThrow(
        'Bedrock instruction validation failed: Authentication failed'
      );
    });

    it('should handle rate limiting errors', async () => {
      mockSend.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        bedrockClient.generateTestSuggestions('Test app')
      ).rejects.toThrow('Bedrock test suggestion failed: Rate limit exceeded');
    });
  });

  describe('configuration management', () => {
    it('should maintain immutable config when getting', () => {
      const config1 = bedrockClient.getConfig();
      const config2 = bedrockClient.getConfig();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same content
    });

    it('should update only specified config properties', () => {
      const originalConfig = bedrockClient.getConfig();

      bedrockClient.updateConfig({ temperature: 0.8 });

      const updatedConfig = bedrockClient.getConfig();
      expect(updatedConfig.temperature).toBe(0.8);
      expect(updatedConfig.modelId).toBe(originalConfig.modelId);
      expect(updatedConfig.region).toBe(originalConfig.region);
    });

    it('should handle partial config updates', () => {
      bedrockClient.updateConfig({
        maxTokens: 2000,
        topP: 0.8,
      });

      const config = bedrockClient.getConfig();
      expect(config.maxTokens).toBe(2000);
      expect(config.topP).toBe(0.8);
    });
  });

  describe('prompt building', () => {
    it('should handle empty natural language text', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  instructions: [],
                  confidence: 0.1,
                  warnings: ['Empty instruction text'],
                  suggestions: ['Provide clear instructions'],
                }),
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await bedrockClient.analyzeInstructions('');

      expect(result.confidence).toBe(0.1);
      expect(result.warnings).toContain('Empty instruction text');
    });

    it('should handle very long instruction text', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify({
                  instructions: [],
                  confidence: 0.5,
                  warnings: ['Text too long'],
                  suggestions: ['Break into smaller steps'],
                }),
              },
            ],
          })
        ),
      };

      mockSend.mockResolvedValue(mockResponse);

      const longText = 'A'.repeat(10000);
      const result = await bedrockClient.analyzeInstructions(longText);

      expect(result.warnings).toContain('Text too long');
      expect(result.suggestions).toContain('Break into smaller steps');
    });
  });
});
