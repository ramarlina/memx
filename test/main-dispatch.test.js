/**
 * Tests for main function dispatcher
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
  main,
  showHelp,
  showMCPConfig,
  cmdTasks,
  cmdDone,
  handleSkillCommand,
  CENTRAL_MEM,
  writeMemFile,
  loadIndex,
  saveIndex,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-main-dispatch-' + Date.now());
let memDir;
let originalArgv;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockReset();
  spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
  execSync.mockClear();
  originalArgv = process.argv;
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  process.argv = originalArgv;
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('showHelp', () => {
  test('displays help information', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    showHelp();

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('mem');
    expect(output).toContain('status');
    expect(output).toContain('goal');
    expect(output).toContain('learn');
  });
});

describe('showMCPConfig', () => {
  test('displays MCP configuration', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    showMCPConfig();

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('mcp');
  });
});

describe('cmdTasks edge cases', () => {
  test('shows no tasks when only main branch', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'main', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '* main', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No tasks');
  });

  test('lists tasks when task branches exist', () => {
    // Mock isTTY to false for non-interactive mode
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'task/first', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '  main\n* task/first\n  task/second', stderr: '' });

    // Create state files for task branches
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');
    writeMemFile(memDir, 'goal.md', '---\ntask: first\n---\n\n# Goal\n\nTest goal\n\n## Progress: 50%');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('handleSkillCommand', () => {
  test('shows skill status', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    handleSkillCommand(['skill']);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles install command', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    // This will try to install but may fail if Claude.ai not configured
    handleSkillCommand(['skill', 'install']);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles install with claude target', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    handleSkillCommand(['skill', 'install', 'claude']);

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('loadIndex and saveIndex with central mem', () => {
  test('saves and loads index correctly', () => {
    const testIndex = {
      '/test/project': 'task/feature',
      '/another/project': 'task/other'
    };

    saveIndex(testIndex);
    const loaded = loadIndex();

    expect(loaded['/test/project']).toBe('task/feature');
    expect(loaded['/another/project']).toBe('task/other');
  });
});

describe('cmdDone edge cases', () => {
  test('shows warning for null memDir', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    await cmdDone(null);

    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo');
  });
});
