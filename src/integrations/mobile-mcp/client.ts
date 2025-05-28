/**
 * Mobile-MCP Client
 * Handles communication with the Mobile-MCP server for Android automation
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { McpClientConfig } from '../../types';
import logger from '../../utils/logger';

/**
 * JSON-RPC message types
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * MCP client connection states
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'initializing'
  | 'ready'
  | 'error';

/**
 * MCP client events
 */
export interface McpClientEvents {
  stateChange: (state: ConnectionState) => void;
  message: (message: JsonRpcResponse | JsonRpcNotification) => void;
  error: (error: Error) => void;
  ready: () => void;
  disconnected: () => void;
}

/**
 * Mobile-MCP Client for Android automation
 */
export class MobileMCPClient extends EventEmitter {
  private config: McpClientConfig;
  private process: ChildProcess | null = null;
  private state: ConnectionState = 'disconnected';
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private messageBuffer = '';
  private initializationPromise: Promise<void> | null = null;

  constructor(config: McpClientConfig) {
    super();
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config,
    };

    // Set up event listeners
    this.on('stateChange', state => {
      logger.info('MCP client state changed', {
        event: 'mcp_state_change',
        previousState: this.state,
        newState: state,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if client is ready for requests
   */
  public isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Connect to MCP server
   */
  public async connect(): Promise<void> {
    if (this.state !== 'disconnected') {
      throw new Error(`Cannot connect from state: ${this.state}`);
    }

    this.setState('connecting');

    try {
      await this.startProcess();
      await this.initialize();
      this.setState('ready');
      this.emit('ready');

      logger.info('MCP client connected successfully', {
        event: 'mcp_connected',
        serverPath: this.config.serverPath,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.setState('error');
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to connect MCP client', {
        event: 'mcp_connection_error',
        error: errorMessage,
        serverPath: this.config.serverPath,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to connect to MCP server: ${errorMessage}`);
    }
  }

  /**
   * Disconnect from MCP server
   */
  public async disconnect(): Promise<void> {
    if (this.state === 'disconnected') {
      return;
    }

    logger.info('Disconnecting from MCP server', {
      event: 'mcp_disconnect_start',
      timestamp: new Date().toISOString(),
    });

    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      request.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    // Kill the process if it exists
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }

    this.setState('disconnected');
    this.process = null;
    this.messageBuffer = '';

    logger.info('Disconnected from MCP server', {
      event: 'mcp_disconnect_complete',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send JSON-RPC request and wait for response
   */
  public async sendRequest(method: string, params?: any): Promise<any> {
    // Allow requests during initialization (for the initialize request itself) and when ready
    if (this.state !== 'initializing' && !this.isReady()) {
      throw new Error(`Client not ready. Current state: ${this.state}`);
    }

    const id = uuidv4();
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      this.sendMessage(request);

      logger.debug('Sent MCP request', {
        event: 'mcp_request_sent',
        method,
        requestId: id,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Send JSON-RPC notification (no response expected)
   */
  public sendNotification(method: string, params?: any): void {
    // Allow notifications during initialization and when ready
    if (this.state !== 'initializing' && !this.isReady()) {
      throw new Error(`Client not ready. Current state: ${this.state}`);
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.sendMessage(notification);

    logger.debug('Sent MCP notification', {
      event: 'mcp_notification_sent',
      method,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Start MCP server process
   */
  private async startProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = this.config.serverArgs || [];

      logger.info('Starting MCP server process', {
        event: 'mcp_process_starting',
        command: this.config.serverPath,
        args,
        timestamp: new Date().toISOString(),
      });

      this.process = spawn(this.config.serverPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      });

      // Handle process events
      this.process.on('error', error => {
        logger.error('MCP process error', {
          event: 'mcp_process_error',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        logger.info('MCP process exited', {
          event: 'mcp_process_exit',
          code,
          signal,
          timestamp: new Date().toISOString(),
        });

        if (this.state !== 'disconnected') {
          this.setState('error');
          this.emit('error', new Error(`Process exited with code ${code}`));
        }
      });

      // Handle stdout data
      this.process.stdout?.on('data', data => {
        this.handleProcessData(data);
      });

      // Handle stderr data
      this.process.stderr?.on('data', data => {
        logger.warn('MCP process stderr', {
          event: 'mcp_process_stderr',
          data: data.toString(),
          timestamp: new Date().toISOString(),
        });
      });

      // Wait for process to start
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.setState('connected');
          resolve();
        } else {
          reject(new Error('Process failed to start'));
        }
      }, 1000);
    });
  }

  /**
   * Initialize MCP connection with handshake
   */
  private async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.setState('initializing');

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform MCP initialization handshake
   */
  private async performInitialization(): Promise<void> {
    try {
      // Send initialize request
      const initResult = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
        },
        clientInfo: {
          name: 'VerifAI',
          version: '1.0.0',
        },
      });

      logger.info('MCP initialization successful', {
        event: 'mcp_initialized',
        serverInfo: initResult.serverInfo,
        capabilities: initResult.capabilities,
        timestamp: new Date().toISOString(),
      });

      // Send initialized notification
      this.sendNotification('notifications/initialized');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('MCP initialization failed', {
        event: 'mcp_initialization_error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Handle incoming data from process
   */
  private handleProcessData(data: Buffer): void {
    this.messageBuffer += data.toString();

    // Process complete messages (separated by newlines)
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          logger.warn('Failed to parse MCP message', {
            event: 'mcp_parse_error',
            line,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  /**
   * Handle parsed JSON-RPC message
   */
  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    this.emit('message', message);

    // Handle responses to pending requests
    if ('id' in message && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(`MCP Error: ${message.error.message}`));
        } else {
          pending.resolve(message.result);
        }

        logger.debug('Received MCP response', {
          event: 'mcp_response_received',
          requestId: message.id,
          hasError: !!message.error,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Send message to MCP server
   */
  private sendMessage(message: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('Process not available');
    }

    const messageStr = JSON.stringify(message) + '\n';
    this.process.stdin.write(messageStr);
  }

  /**
   * Set connection state and emit events
   */
  private setState(newState: ConnectionState): void {
    this.state = newState;
    this.emit('stateChange', newState);

    logger.debug('MCP client state changed', {
      event: 'mcp_state_change',
      state: newState,
      timestamp: new Date().toISOString(),
    });
  }
}

export default MobileMCPClient;
