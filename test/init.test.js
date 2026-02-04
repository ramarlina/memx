/**
 * Tests for initialization and task creation functions
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
  cmdInit,
  cmdTasks,
  writeMemFile,
  readMemFile,
  git,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-init-' + Date.now());
let memDir;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockClear();
  execSync.mockClear();
  jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('cmdInit', () => {
  test('shows usage when name missing and no existing memDir', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    await cmdInit([], null);
    // With no memDir and no name, it should show usage
  });

  test('creates task branch in existing repo', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    await cmdInit(['new-task'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', 'task/new-task'],
      expect.any(Object)
    );
  });

  test('creates task with goal', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    await cmdInit(['my-task', 'Build', 'a', 'feature'], memDir);

    // Should create files
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['add', '-A'],
      expect.any(Object)
    );
  });
});

describe('cmdTasks', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('shows no tasks when empty', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'main\n', stderr: '' }) // getCurrentBranch
      .mockReturnValueOnce({ status: 0, stdout: '* main', stderr: '' }); // branch list

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No tasks');
  });

  test('lists tasks in non-TTY mode', () => {
    // Mock process.stdin.isTTY to be false
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'task/test\n', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '  main\n* task/test', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');
    writeMemFile(memDir, 'goal.md', '# Goal\n\nTest\n\n## Progress: 50%');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks([], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});
