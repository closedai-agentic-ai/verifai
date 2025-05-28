/**
 * Mobile-MCP Integration
 * Exports for Mobile-MCP client and automation
 */

export { MobileMCPClient, ConnectionState } from './client';
export { MobileAutomation, ScreenshotResult, ElementInfo } from './automation';

// Re-export types from main types
export type { McpClientConfig, ElementSelector } from '../../types';
