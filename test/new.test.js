/**
 * Tests for cmdNew and related functions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Track exit calls
let mockExitCode = null;

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
  cmdNew,
  writeMemFile,
  readMemFile,
  CENTRAL_MEM,
  loadIndex,
  saveIndex,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-new-' + Date.now());
let memDir;
let originalExit;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockClear();
  execSync.mockClear();
  mockExitCode = null;
  originalExit = process.exit;
  process.exit = jest.fn((code) => {
    mockExitCode = code;
    throw new Error(`process.exit(${code})`);
  });
  jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  process.exit = originalExit;
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('cmdNew', () => {
  test('shows usage when no goal provided', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    try {
      cmdNew([], memDir);
    } catch (e) {
      expect(e.message).toContain('process.exit');
    }

    expect(mockExitCode).toBe(1);
    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('shows JSON error when no goal in JSON mode', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    try {
      cmdNew(['--json'], memDir);
    } catch (e) {
      // expected
    }

    expect(mockExitCode).toBe(1);
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('error');
  });

  test('creates task with default provider', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdNew(['Build', 'a', 'feature'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Created task');
    expect(output).toContain('build-a-feature');
  });

  test('creates task with custom provider', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdNew(['Build', 'something', '--provider', 'gemini'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('gemini');
  });

  test('creates task with -P flag', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdNew(['Test', 'task', '-P', 'ollama'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('ollama');
  });

  test('creates task with custom directory', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdNew(['My', 'task', '--dir', '/custom/path'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('/custom/path');
  });

  test('outputs JSON in JSON mode', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdNew(['--json', 'JSON', 'task'], memDir);

    const output = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0];
    const parsed = JSON.parse(output);
    expect(parsed.taskName).toBe('json-task');
    expect(parsed.goal).toBe('JSON task');
  });

  test('handles error gracefully', () => {
    spawnSync.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'git error' });

    try {
      cmdNew(['Failing', 'task'], memDir);
    } catch (e) {
      expect(e.message).toContain('process.exit');
    }

    expect(mockExitCode).toBe(1);
  });

  test('handles error in JSON mode', () => {
    spawnSync.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'git error' });

    const consoleSpy = jest.spyOn(console, 'log');

    try {
      cmdNew(['--json', 'Failing', 'task'], memDir);
    } catch (e) {
      // expected
    }

    expect(mockExitCode).toBe(1);
    const output = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0];
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
  });
});
