/**
 * Tests for MCP server start() and related functions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

// Create mock readline interface
class MockReadlineInterface extends EventEmitter {
  constructor() {
    super();
    this.closed = false;
  }
  close() {
    this.closed = true;
  }
}

let mockRlInstance = null;

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
  spawn: jest.fn()
}));

// Mock readline with controllable interface
jest.mock('readline', () => ({
  createInterface: jest.fn(() => {
    mockRlInstance = new MockReadlineInterface();
    return mockRlInstance;
  })
}));

const { MCPServer } = require('../mcp.js');
const { spawnSync, spawn } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-mcp-server-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(testDir, '.mem', '.git'), { recursive: true });
  spawnSync.mockReset();
  spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
  spawn.mockReset();
  mockRlInstance = null;
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('MCPServer start()', () => {
  test('starts server and handles valid JSON-RPC message', () => {
    const server = new MCPServer(testDir);
    server.start();

    // Simulate receiving a valid message
    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });

    mockRlInstance.emit('line', message);

    expect(console.log).toHaveBeenCalled();
  });

  test('handles parse error for invalid JSON', () => {
    const server = new MCPServer(testDir);
    server.start();

    // Simulate receiving invalid JSON
    mockRlInstance.emit('line', 'not valid json');

    // Should log parse error response
    const calls = console.log.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const response = JSON.parse(lastCall);
    expect(response.error.code).toBe(-32700);
    expect(response.error.message).toBe('Parse error');
  });

  test('handles tools/list request', () => {
    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    mockRlInstance.emit('line', message);

    const calls = console.log.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const response = JSON.parse(lastCall);
    expect(response.result.tools).toBeDefined();
    expect(Array.isArray(response.result.tools)).toBe(true);
  });

  test('handles tools/call for mem_status', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });

    // Create necessary files
    fs.writeFileSync(
      path.join(testDir, '.mem', 'goal.md'),
      '---\ntask: test\n---\n\n# Goal\n\nTest goal'
    );
    fs.writeFileSync(
      path.join(testDir, '.mem', 'state.md'),
      '---\nstatus: active\n---\n\n# State'
    );

    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'mem_status',
        arguments: {}
      }
    });

    mockRlInstance.emit('line', message);

    const calls = console.log.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
  });

  test('handles tools/call for mem_context', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });

    fs.writeFileSync(
      path.join(testDir, '.mem', 'goal.md'),
      '# Goal\n\nTest'
    );
    fs.writeFileSync(
      path.join(testDir, '.mem', 'state.md'),
      '---\nstatus: active\n---\n\n'
    );

    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'mem_context',
        arguments: {}
      }
    });

    mockRlInstance.emit('line', message);

    expect(console.log).toHaveBeenCalled();
  });

  test('handles tools/call for mem_checkpoint', () => {
    fs.writeFileSync(
      path.join(testDir, '.mem', 'state.md'),
      '---\nstatus: active\n---\n\n## Checkpoints\n\n- [ ] Started'
    );

    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'mem_checkpoint',
        arguments: { text: 'New checkpoint' }
      }
    });

    mockRlInstance.emit('line', message);

    expect(console.log).toHaveBeenCalled();
  });

  test('handles tools/call for mem_learn', () => {
    fs.writeFileSync(
      path.join(testDir, '.mem', 'memory.md'),
      '# Learnings\n\n'
    );

    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'mem_learn',
        arguments: { insight: 'New insight' }
      }
    });

    mockRlInstance.emit('line', message);

    expect(console.log).toHaveBeenCalled();
  });

  test('handles tools/call for mem_next', () => {
    fs.writeFileSync(
      path.join(testDir, '.mem', 'state.md'),
      '---\nstatus: active\n---\n\n## Next Step\n\nOld step'
    );

    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'mem_next',
        arguments: { step: 'New step' }
      }
    });

    mockRlInstance.emit('line', message);

    expect(console.log).toHaveBeenCalled();
  });

  test('handles tools/call for unknown tool', () => {
    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'unknown_tool',
        arguments: {}
      }
    });

    mockRlInstance.emit('line', message);

    const calls = console.log.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1][0];
    const response = JSON.parse(lastCall);
    // Unknown tool returns a result with error message in content, not a JSON-RPC error
    expect(response.result || response.error).toBeDefined();
  });

  test('handles unknown method', () => {
    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 9,
      method: 'unknown/method',
      params: {}
    });

    mockRlInstance.emit('line', message);

    const calls = console.log.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const response = JSON.parse(lastCall);
    expect(response.error.code).toBe(-32601);
  });

  test('handles close event', () => {
    const originalExit = process.exit;
    process.exit = jest.fn();

    const server = new MCPServer(testDir);
    server.start();

    mockRlInstance.emit('close');

    expect(process.exit).toHaveBeenCalledWith(0);

    process.exit = originalExit;
  });

  test('handles notification (no id)', () => {
    const server = new MCPServer(testDir);
    server.start();

    const message = JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    });

    mockRlInstance.emit('line', message);

    // Notifications don't produce responses
    // Just verify no error was thrown
    expect(mockRlInstance.closed).toBe(false);
  });
});
