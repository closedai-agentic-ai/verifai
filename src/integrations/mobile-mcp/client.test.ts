/**
 * Tests for MobileMCPClient
 */

import { EventEmitter } from 'events';
import { MobileMCPClient, ConnectionState } from './client';
import { McpClientConfig } from '../../types';

// Mock child_process
jest.mock('child_process');
jest.mock('../../utils/logger');

describe('MobileMCPClient', () => {
  let client: MobileMCPClient;
  let config: McpClientConfig;
  let mockChildProcess: any;
  let mockSpawn: jest.Mock;

  // Helper function to simulate successful connection
  const simulateConnection = async (clientInstance: MobileMCPClient) => {
    const connectPromise = clientInstance.connect();

    // Wait for the process to start and send the initialize request
    await new Promise(resolve => setTimeout(resolve, 100));

    // Auto-respond to any initialize request
    const originalWrite = mockChildProcess.stdin.write;
    mockChildProcess.stdin.write = jest.fn((data: string) => {
      try {
        const message = JSON.parse(data);
        if (message.method === 'initialize') {
          // Immediately respond to initialize request
          setTimeout(() => {
            const response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                serverInfo: { name: 'mobile-mcp', version: '1.0.0' },
                capabilities: {},
              },
            };
            mockChildProcess.stdout.emit(
              'data',
              JSON.stringify(response) + '\n'
            );
          }, 10);
        }
      } catch (error) {
        // Ignore parse errors
      }
      return originalWrite.call(mockChildProcess.stdin, data);
    });

    return connectPromise;
  };

  beforeEach(() => {
    config = {
      serverPath: 'npx',
      serverArgs: ['-y', '@mobilenext/mobile-mcp@latest'],
      timeout: 1000, // Shorter timeout for tests
      retryAttempts: 2,
    };

    // Create a comprehensive mock child process
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.stdin = {
      write: jest.fn(),
    };
    mockChildProcess.kill = jest.fn();
    mockChildProcess.killed = false;

    // Mock spawn to return our mock child process
    mockSpawn = jest.fn().mockReturnValue(mockChildProcess);
    require('child_process').spawn = mockSpawn;

    client = new MobileMCPClient(config);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any active connections
    if (client.getState() !== 'disconnected') {
      try {
        await client.disconnect();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('constructor', () => {
    it('should initialize with correct default config', () => {
      const defaultClient = new MobileMCPClient({ serverPath: 'test' });
      expect(defaultClient.getState()).toBe('disconnected');
      expect(defaultClient.isReady()).toBe(false);
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { serverPath: 'custom', timeout: 10000 };
      const customClient = new MobileMCPClient(customConfig);
      expect(customClient.getState()).toBe('disconnected');
    });
  });

  describe('connection lifecycle', () => {
    it('should start in disconnected state', () => {
      expect(client.getState()).toBe('disconnected');
      expect(client.isReady()).toBe(false);
    });

    it('should handle successful connection process', async () => {
      const stateChanges: ConnectionState[] = [];
      client.on('stateChange', state => stateChanges.push(state));

      await simulateConnection(client);

      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('connected');
      expect(stateChanges).toContain('initializing');
      expect(stateChanges).toContain('ready');
      expect(client.isReady()).toBe(true);
    });

    it('should handle connection failure', async () => {
      const connectPromise = client.connect();

      // Simulate process error immediately
      await new Promise(resolve => setTimeout(resolve, 10));
      mockChildProcess.emit('error', new Error('Process failed'));

      await expect(connectPromise).rejects.toThrow('Process failed');
      expect(client.getState()).toBe('error');
    });
  });

  describe('sendRequest when connected', () => {
    beforeEach(async () => {
      await simulateConnection(client);
      jest.clearAllMocks(); // Clear mocks after connection setup
    });

    it('should send request and receive response', async () => {
      const requestPromise = client.sendRequest('test_method', {
        param: 'value',
      });

      // Wait for the request to be sent
      await new Promise(resolve => setTimeout(resolve, 10));

      // Find and respond to the test_method request
      const writeCall = mockChildProcess.stdin.write.mock.calls.find(
        (call: any[]) => {
          try {
            const message = JSON.parse(call[0]);
            return message.method === 'test_method';
          } catch {
            return false;
          }
        }
      );

      expect(writeCall).toBeDefined();

      if (writeCall) {
        const request = JSON.parse(writeCall[0]);
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: { success: true },
        };
        mockChildProcess.stdout.emit('data', JSON.stringify(response) + '\n');
      }

      const result = await requestPromise;
      expect(result).toEqual({ success: true });
    });

    it('should handle error responses', async () => {
      const requestPromise = client.sendRequest('test_method');

      // Wait for the request to be sent
      await new Promise(resolve => setTimeout(resolve, 10));

      // Find and respond with error to the test_method request
      const writeCall = mockChildProcess.stdin.write.mock.calls.find(
        (call: any[]) => {
          try {
            const message = JSON.parse(call[0]);
            return message.method === 'test_method';
          } catch {
            return false;
          }
        }
      );

      if (writeCall) {
        const request = JSON.parse(writeCall[0]);
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -1, message: 'Test error' },
        };
        mockChildProcess.stdout.emit('data', JSON.stringify(response) + '\n');
      }

      await expect(requestPromise).rejects.toThrow('MCP Error: Test error');
    });
  });

  describe('sendNotification when connected', () => {
    beforeEach(async () => {
      await simulateConnection(client);
      jest.clearAllMocks();
    });

    it('should send notification without expecting response', () => {
      client.sendNotification('test_notification', { data: 'test' });

      // Verify the notification was sent
      const writeCall = mockChildProcess.stdin.write.mock.calls.find(
        (call: any[]) => {
          try {
            const message = JSON.parse(call[0]);
            return message.method === 'test_notification' && !('id' in message);
          } catch {
            return false;
          }
        }
      );

      expect(writeCall).toBeDefined();
    });
  });

  describe('error scenarios', () => {
    it('should reject requests when not ready', async () => {
      const disconnectedClient = new MobileMCPClient(config);
      await expect(disconnectedClient.sendRequest('test')).rejects.toThrow(
        'Client not ready. Current state: disconnected'
      );
    });

    it('should reject notifications when not ready', () => {
      const disconnectedClient = new MobileMCPClient(config);
      expect(() => disconnectedClient.sendNotification('test')).toThrow(
        'Client not ready. Current state: disconnected'
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      const connectPromise = client.connect();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send malformed JSON - should not crash
      mockChildProcess.stdout.emit('data', 'invalid json\n');

      // Auto-respond to initialize request
      const originalWrite = mockChildProcess.stdin.write;
      mockChildProcess.stdin.write = jest.fn((data: string) => {
        try {
          const message = JSON.parse(data);
          if (message.method === 'initialize') {
            setTimeout(() => {
              const response = {
                jsonrpc: '2.0',
                id: message.id,
                result: { serverInfo: {}, capabilities: {} },
              };
              mockChildProcess.stdout.emit(
                'data',
                JSON.stringify(response) + '\n'
              );
            }, 10);
          }
        } catch (error) {
          // Ignore parse errors
        }
        return originalWrite.call(mockChildProcess.stdin, data);
      });

      await connectPromise;
      expect(client.isReady()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect cleanly', async () => {
      await simulateConnection(client);

      // Now disconnect
      await client.disconnect();
      expect(client.getState()).toBe('disconnected');
      expect(mockChildProcess.kill).toHaveBeenCalled();
    });
  });
});
