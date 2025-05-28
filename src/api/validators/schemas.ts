/**
 * Validation Schemas
 * Joi schemas for request validation corresponding to TypeScript types
 */

import Joi from 'joi';

// =============================================================================
// Common Schemas
// =============================================================================

export const uuidSchema = Joi.string().uuid().required();
export const timestampSchema = Joi.string().isoDate();
export const urlSchema = Joi.string().uri();
export const emailSchema = Joi.string().email();

// =============================================================================
// Test Request Schemas
// =============================================================================

/**
 * Test execution request schema (POST /api/v1/sanity-test)
 */
export const testRequestSchema = Joi.object({
  jiraTicketId: Joi.string()
    .pattern(/^[A-Z]+-\d+$/)
    .required()
    .description('JIRA ticket ID in format PROJECT-123'),
  commitSha: Joi.string()
    .length(40)
    .pattern(/^[a-f0-9]+$/)
    .required()
    .description('Git commit SHA (40 character hex string)'),
  repositoryUrl: urlSchema.required().description('GitHub repository URL'),
  testInstructionsUrl: urlSchema
    .required()
    .description('S3 pre-signed URL for test instructions'),
  metadata: Joi.object({
    prNumber: Joi.number().integer().positive().required(),
    branch: Joi.string().min(1).max(255).required(),
    author: emailSchema.required(),
    buildId: Joi.string().optional(),
    environment: Joi.string()
      .valid('development', 'staging', 'production')
      .optional(),
  }).required(),
});

/**
 * Test status query schema
 */
export const testStatusQuerySchema = Joi.object({
  testRunId: uuidSchema,
  includeSteps: Joi.boolean().default(false),
  includeScreenshots: Joi.boolean().default(false),
  includeLogs: Joi.boolean().default(false),
});

// =============================================================================
// Test Instruction Schemas
// =============================================================================

/**
 * Element selector schema
 */
export const elementSelectorSchema = Joi.object({
  type: Joi.string()
    .valid('id', 'xpath', 'text', 'class', 'accessibility')
    .required(),
  value: Joi.string().min(1).required(),
  timeout: Joi.number().integer().min(1000).max(60000).optional(),
});

/**
 * Test instruction schema
 */
export const testInstructionSchema = Joi.object({
  id: Joi.string().required(),
  action: Joi.string()
    .valid(
      'LAUNCH_APP',
      'TAP_ELEMENT',
      'TYPE_TEXT',
      'WAIT_FOR_ELEMENT',
      'VERIFY_ELEMENT_COUNT',
      'VERIFY_TEXT',
      'TAKE_SCREENSHOT',
      'SCROLL',
      'SWIPE',
      'PRESS_BACK',
      'PRESS_HOME',
      'ASSERT_VISIBLE',
      'ASSERT_NOT_VISIBLE'
    )
    .required(),
  selector: elementSelectorSchema.optional(),
  parameters: Joi.object().optional(),
  description: Joi.string().max(500).optional(),
  timeout: Joi.number().integer().min(1000).max(300000).optional(),
  retryCount: Joi.number().integer().min(0).max(5).default(0),
  screenshotOnFailure: Joi.boolean().default(true),
});

/**
 * Test instructions array schema
 */
export const testInstructionsSchema = Joi.array()
  .items(testInstructionSchema)
  .min(1)
  .max(100);

// =============================================================================
// Device & APK Schemas
// =============================================================================

/**
 * Device info schema
 */
export const deviceInfoSchema = Joi.object({
  deviceId: Joi.string().required(),
  name: Joi.string().required(),
  platform: Joi.string().valid('android', 'ios').required(),
  platformVersion: Joi.string().required(),
  manufacturer: Joi.string().optional(),
  model: Joi.string().optional(),
  screenSize: Joi.object({
    width: Joi.number().integer().positive().required(),
    height: Joi.number().integer().positive().required(),
  }).required(),
  density: Joi.number().positive().required(),
  isEmulator: Joi.boolean().required(),
  status: Joi.string().valid('available', 'busy', 'offline').required(),
});

/**
 * APK info schema
 */
export const apkInfoSchema = Joi.object({
  filename: Joi.string()
    .pattern(/\.apk$/)
    .required(),
  packageName: Joi.string()
    .pattern(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)
    .required(),
  versionName: Joi.string().required(),
  versionCode: Joi.number().integer().positive().required(),
  size: Joi.number().integer().positive().required(),
  checksum: Joi.string()
    .length(64)
    .pattern(/^[a-f0-9]+$/)
    .required(),
  downloadUrl: urlSchema.required(),
  localPath: Joi.string().optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  activities: Joi.array().items(Joi.string()).optional(),
});

/**
 * Emulator configuration schema
 */
export const emulatorConfigSchema = Joi.object({
  name: Joi.string().required(),
  apiLevel: Joi.number().integer().min(21).max(34).required(),
  target: Joi.string().required(),
  abi: Joi.string()
    .valid('x86', 'x86_64', 'arm64-v8a', 'armeabi-v7a')
    .required(),
  device: Joi.string().required(),
  sdcardSize: Joi.string()
    .pattern(/^\d+[MG]$/)
    .optional(),
  ramSize: Joi.string()
    .pattern(/^\d+[MG]$/)
    .optional(),
  heapSize: Joi.string()
    .pattern(/^\d+[MG]$/)
    .optional(),
  additionalOptions: Joi.array().items(Joi.string()).optional(),
});

// =============================================================================
// Configuration Schemas
// =============================================================================

/**
 * AWS Bedrock configuration schema
 */
export const bedrockConfigSchema = Joi.object({
  modelId: Joi.string().required(),
  region: Joi.string().required(),
  maxTokens: Joi.number().integer().min(1).max(100000).optional(),
  temperature: Joi.number().min(0).max(1).optional(),
  topP: Joi.number().min(0).max(1).optional(),
});

/**
 * MCP client configuration schema
 */
export const mcpClientConfigSchema = Joi.object({
  serverPath: Joi.string().required(),
  serverArgs: Joi.array().items(Joi.string()).optional(),
  timeout: Joi.number().integer().min(1000).max(300000).optional(),
  retryAttempts: Joi.number().integer().min(0).max(10).optional(),
});

/**
 * JIRA configuration schema
 */
export const jiraConfigSchema = Joi.object({
  baseUrl: urlSchema.required(),
  email: emailSchema.required(),
  apiToken: Joi.string().required(),
  projectKey: Joi.string()
    .pattern(/^[A-Z]+$/)
    .optional(),
  issueType: Joi.string().optional(),
});

// =============================================================================
// Health Check Schemas
// =============================================================================

/**
 * Health check query parameters schema
 */
export const healthCheckQuerySchema = Joi.object({
  detailed: Joi.boolean().default(false),
  includeDependencies: Joi.boolean().default(true),
  includeSystem: Joi.boolean().default(true),
});

// =============================================================================
// Pagination Schemas
// =============================================================================

/**
 * Pagination query schema
 */
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

// =============================================================================
// File Upload Schemas
// =============================================================================

/**
 * APK upload schema
 */
export const apkUploadSchema = Joi.object({
  filename: Joi.string()
    .pattern(/\.apk$/)
    .required(),
  size: Joi.number()
    .integer()
    .min(1)
    .max(500 * 1024 * 1024)
    .required(), // Max 500MB
  checksum: Joi.string()
    .length(64)
    .pattern(/^[a-f0-9]+$/)
    .optional(),
});

/**
 * Test instructions upload schema
 */
export const testInstructionsUploadSchema = Joi.object({
  filename: Joi.string()
    .pattern(/\.(txt|md|json)$/)
    .required(),
  size: Joi.number()
    .integer()
    .min(1)
    .max(10 * 1024 * 1024)
    .required(), // Max 10MB
  format: Joi.string().valid('text', 'markdown', 'json').default('text'),
});

// =============================================================================
// Error Response Schemas
// =============================================================================

/**
 * Error response schema
 */
export const errorResponseSchema = Joi.object({
  error: Joi.string().required(),
  message: Joi.string().required(),
  details: Joi.any().optional(),
  timestamp: timestampSchema.required(),
  code: Joi.string().optional(),
  context: Joi.object().optional(),
});

// =============================================================================
// Authentication Schemas
// =============================================================================

/**
 * API key header schema
 */
export const apiKeyHeaderSchema = Joi.object({
  'x-api-key': Joi.string().min(32).required(),
}).unknown(true);

// =============================================================================
// Test Result Schemas
// =============================================================================

/**
 * Test step result schema
 */
export const testStepResultSchema = Joi.object({
  instructionId: Joi.string().required(),
  status: Joi.string().valid('success', 'failed', 'skipped').required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  duration: Joi.number().integer().min(0).required(),
  screenshot: Joi.string().optional(),
  error: Joi.object({
    message: Joi.string().required(),
    stack: Joi.string().optional(),
    code: Joi.string().optional(),
  }).optional(),
  metadata: Joi.object().optional(),
});

/**
 * Test result schema
 */
export const testResultSchema = Joi.object({
  testRunId: uuidSchema,
  status: Joi.string()
    .valid('pending', 'running', 'completed', 'failed', 'cancelled')
    .required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().optional(),
  duration: Joi.number().integer().min(0).optional(),
  totalSteps: Joi.number().integer().min(0).required(),
  passedSteps: Joi.number().integer().min(0).required(),
  failedSteps: Joi.number().integer().min(0).required(),
  skippedSteps: Joi.number().integer().min(0).required(),
  steps: Joi.array().items(testStepResultSchema).required(),
  screenshots: Joi.array().items(Joi.string()).required(),
  logs: Joi.array().items(Joi.string()).required(),
  metadata: Joi.object({
    apkInfo: apkInfoSchema.optional(),
    deviceInfo: deviceInfoSchema.optional(),
    testInstructions: testInstructionsSchema.optional(),
    jiraTicketId: Joi.string().optional(),
    commitSha: Joi.string().optional(),
  }).required(),
  error: Joi.object({
    message: Joi.string().required(),
    stack: Joi.string().optional(),
    code: Joi.string().optional(),
  }).optional(),
});

// =============================================================================
// Export all schemas
// =============================================================================

export const schemas = {
  // Request schemas
  testRequest: testRequestSchema,
  testStatusQuery: testStatusQuerySchema,
  healthCheckQuery: healthCheckQuerySchema,
  pagination: paginationSchema,

  // Entity schemas
  testInstruction: testInstructionSchema,
  testInstructions: testInstructionsSchema,
  elementSelector: elementSelectorSchema,
  deviceInfo: deviceInfoSchema,
  apkInfo: apkInfoSchema,
  emulatorConfig: emulatorConfigSchema,

  // Configuration schemas
  bedrockConfig: bedrockConfigSchema,
  mcpClientConfig: mcpClientConfigSchema,
  jiraConfig: jiraConfigSchema,

  // Upload schemas
  apkUpload: apkUploadSchema,
  testInstructionsUpload: testInstructionsUploadSchema,

  // Result schemas
  testStepResult: testStepResultSchema,
  testResult: testResultSchema,

  // Common schemas
  uuid: uuidSchema,
  timestamp: timestampSchema,
  url: urlSchema,
  email: emailSchema,
  apiKeyHeader: apiKeyHeaderSchema,
  errorResponse: errorResponseSchema,
};
