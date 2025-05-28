/**
 * VerifAI Type Definitions
 * Core interfaces and types for the application
 */

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Test execution request from CI/CD
 */
export interface TestRequest {
  jiraTicketId: string;
  commitSha: string;
  repositoryUrl: string;
  testInstructionsUrl: string;
  metadata: {
    prNumber: number;
    branch: string;
    author: string;
    buildId?: string;
    environment?: string;
  };
}

/**
 * Test execution response
 */
export interface TestResponse {
  success: boolean;
  testRunId: string;
  message: string;
  estimatedDuration: string;
  timestamp: string;
}

// =============================================================================
// Test Execution Types
// =============================================================================

/**
 * Test execution status
 */
export type TestStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Test instruction action types
 */
export type TestActionType =
  | 'LAUNCH_APP'
  | 'TAP_ELEMENT'
  | 'TYPE_TEXT'
  | 'WAIT_FOR_ELEMENT'
  | 'VERIFY_ELEMENT_COUNT'
  | 'VERIFY_TEXT'
  | 'TAKE_SCREENSHOT'
  | 'SCROLL'
  | 'SWIPE'
  | 'PRESS_BACK'
  | 'PRESS_HOME'
  | 'ASSERT_VISIBLE'
  | 'ASSERT_NOT_VISIBLE';

/**
 * Element selector types
 */
export type SelectorType = 'id' | 'xpath' | 'text' | 'class' | 'accessibility';

/**
 * Element selector
 */
export interface ElementSelector {
  type: SelectorType;
  value: string;
  timeout?: number;
}

/**
 * Test instruction step
 */
export interface TestInstruction {
  id: string;
  action: TestActionType;
  selector?: ElementSelector;
  parameters?: Record<string, any>;
  description?: string;
  timeout?: number;
  retryCount?: number;
  screenshotOnFailure?: boolean;
}

/**
 * Test step execution result
 */
export interface TestStepResult {
  instructionId: string;
  status: 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  screenshot?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Complete test execution result
 */
export interface TestResult {
  testRunId: string;
  status: TestStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  steps: TestStepResult[];
  screenshots: string[];
  logs: string[];
  metadata: {
    apkInfo?: ApkInfo;
    deviceInfo?: DeviceInfo;
    testInstructions?: TestInstruction[];
    jiraTicketId?: string;
    commitSha?: string;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

// =============================================================================
// Mobile Device & APK Types
// =============================================================================

/**
 * Android device information
 */
export interface DeviceInfo {
  id: string;
  deviceId?: string; // Legacy support
  name?: string;
  platform?: 'android' | 'ios';
  platformVersion?: string;
  manufacturer?: string;
  model?: string;
  androidVersion?: string;
  apiLevel?: number;
  screenSize?: {
    width: number;
    height: number;
  };
  density?: number;
  isEmulator: boolean;
  status?: 'available' | 'busy' | 'offline';
}

/**
 * APK file information
 */
export interface ApkInfo {
  filename: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  size: number;
  checksum: string;
  downloadUrl: string;
  localPath?: string;
  permissions?: string[];
  activities?: string[];
}

/**
 * Emulator configuration
 */
export interface EmulatorConfig {
  name?: string;
  apiLevel?: number;
  target?: string;
  abi?: string;
  device?: string;
  sdcardSize?: string;
  ramSize?: string;
  heapSize?: string;
  additionalOptions?: string[];
  // EmulatorManager specific properties
  androidSdkPath?: string;
  emulatorName?: string;
  deviceTimeout?: number;
  bootTimeout?: number;
}

// =============================================================================
// AI & MCP Integration Types
// =============================================================================

/**
 * AWS Bedrock model configuration
 */
export interface BedrockConfig {
  modelId: string;
  region: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

/**
 * MCP client configuration
 */
export interface McpClientConfig {
  serverPath: string;
  serverArgs?: string[];
  timeout?: number;
  retryAttempts?: number;
}

/**
 * AI instruction analysis result
 */
export interface InstructionAnalysis {
  originalText: string;
  parsedInstructions: TestInstruction[];
  confidence: number;
  warnings: string[];
  suggestions: string[];
}

// =============================================================================
// JIRA Integration Types
// =============================================================================

/**
 * JIRA configuration
 */
export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey?: string;
  issueType?: string;
}

/**
 * JIRA ticket update payload
 */
export interface JiraTicketUpdate {
  ticketId: string;
  status?: string;
  comment?: string;
  attachments?: {
    filename: string;
    content: Buffer | string;
    mimeType: string;
  }[];
  customFields?: Record<string, any>;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Application configuration
 */
export interface AppConfig {
  api: {
    port: number;
    apiKey: string;
    environment: string;
  };
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bedrock: BedrockConfig;
  };
  android: {
    home: string;
    sdkRoot: string;
    adbPath: string;
    emulatorName: string;
  };
  jira: JiraConfig;
  mcp: {
    mobile: McpClientConfig;
    jira: McpClientConfig;
    claudeCliPath: string;
  };
  storage: {
    tempDir: string;
    screenshotsDir: string;
    apkDownloadDir: string;
    logsDir: string;
  };
  logging: {
    level: string;
    format: string;
    maxSize: string;
    maxFiles: number;
  };
  testing: {
    timeout: number;
    emulatorStartupTimeout: number;
    elementWaitTimeout: number;
    screenshotOnFailure: boolean;
    maxConcurrentTests: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

// =============================================================================
// Health Check Types
// =============================================================================

/**
 * Dependency health status
 */
export interface DependencyHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
  lastChecked?: Date;
}

/**
 * System health information
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  environment: string;
  dependencies: {
    [key: string]: DependencyHealth;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      loadAverage: number[];
    };
    disk?: {
      available: number;
      total: number;
      percentage: number;
    };
  };
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Application error codes
 */
export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',

  // Test execution errors
  TEST_EXECUTION_ERROR = 'TEST_EXECUTION_ERROR',
  INSTRUCTION_PARSE_ERROR = 'INSTRUCTION_PARSE_ERROR',
  ELEMENT_NOT_FOUND_ERROR = 'ELEMENT_NOT_FOUND_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Device/Emulator errors
  DEVICE_NOT_AVAILABLE_ERROR = 'DEVICE_NOT_AVAILABLE_ERROR',
  EMULATOR_START_ERROR = 'EMULATOR_START_ERROR',
  APK_INSTALL_ERROR = 'APK_INSTALL_ERROR',

  // Integration errors
  BEDROCK_ERROR = 'BEDROCK_ERROR',
  JIRA_ERROR = 'JIRA_ERROR',
  MCP_ERROR = 'MCP_ERROR',
  GITHUB_ERROR = 'GITHUB_ERROR',
  S3_ERROR = 'S3_ERROR',
}

/**
 * Structured application error
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: any;
  stack?: string;
  timestamp: Date;
  context?: {
    testRunId?: string;
    instructionId?: string;
    deviceId?: string;
    userId?: string;
    [key: string]: any;
  };
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract keys of type T that are of type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Timestamp string in ISO format
 */
export type ISOTimestamp = string;

/**
 * UUID string
 */
export type UUID = string;
