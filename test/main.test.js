/**
 * Tests for main function and help
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock child_process before requiring index.js
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
  spawn: jest.fn()
}));

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((q, cb) => cb('')),
    close: jest.fn(),
    on: jest.fn()
  }))
}));

const {
  showHelp,
  showMCPConfig,
  startMCPServer
} = require('../index.js');

const { spawn } = require('child_process');

describe('showHelp', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('displays help message', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('mem');
    expect(output).toContain('Persistent memory');
  });

  test('shows LIFECYCLE section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('LIFECYCLE');
    expect(output).toContain('init');
    expect(output).toContain('status');
    expect(output).toContain('done');
  });

  test('shows PROGRESS section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('PROGRESS');
    expect(output).toContain('goal');
    expect(output).toContain('next');
    expect(output).toContain('checkpoint');
    expect(output).toContain('stuck');
  });

  test('shows LEARNING section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('LEARNING');
    expect(output).toContain('learn');
    expect(output).toContain('playbook');
    expect(output).toContain('promote');
  });

  test('shows QUERY section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('QUERY');
    expect(output).toContain('context');
    expect(output).toContain('history');
    expect(output).toContain('query');
  });

  test('shows TASKS section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('TASKS');
    expect(output).toContain('tasks');
    expect(output).toContain('switch');
  });

  test('shows PRIMITIVES section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('SYNC');
    expect(output).toContain('sync');
  });

  test('shows WAKE section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('WAKE');
    expect(output).toContain('wake');
    expect(output).toContain('cron');
  });

  test('shows INTEGRATION section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('INTEGRATION');
    expect(output).toContain('skill');
    expect(output).toContain('mcp');
  });

  test('shows EXAMPLES section', () => {
    showHelp();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('EXAMPLES');
  });
});

describe('showMCPConfig', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('shows MCP configuration', () => {
    showMCPConfig();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('MCP Server Configuration');
    expect(output).toContain('mcpServers');
    expect(output).toContain('mem');
  });

  test('shows Claude Desktop config path', () => {
    showMCPConfig();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Claude Desktop');
    expect(output).toContain('claude_desktop_config.json');
  });

  test('shows project-specific config example', () => {
    showMCPConfig();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('--dir');
    expect(output).toContain('/path/to/your/project');
  });
});

describe('startMCPServer', () => {
  let mockChild;

  beforeEach(() => {
    mockChild = {
      on: jest.fn()
    };
    spawn.mockReturnValue(mockChild);
  });

  afterEach(() => {
    spawn.mockClear();
  });

  test('spawns MCP server process', () => {
    startMCPServer(['mcp']);

    expect(spawn).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining([expect.stringContaining('mcp.js')]),
      expect.objectContaining({ stdio: 'inherit' })
    );
  });

  test('passes through arguments', () => {
    startMCPServer(['mcp', '--dir', '/test/path']);

    expect(spawn).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining(['--dir', '/test/path']),
      expect.any(Object)
    );
  });

  test('sets up error handler', () => {
    startMCPServer(['mcp']);

    expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('sets up exit handler', () => {
    startMCPServer(['mcp']);

    expect(mockChild.on).toHaveBeenCalledWith('exit', expect.any(Function));
  });
});
