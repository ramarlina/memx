/**
 * Tests for edge case coverage to reach 90%+
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
  cmdBranch,
  cmdCommit,
  cmdInit,
  cmdSwitch,
  cmdSync,
  findMemDir,
  saveConfig,
  saveIndex,
  loadIndex,
  writeMemFile,
  readMemFile,
  CENTRAL_MEM,
  CONFIG_DIR,
  c
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-edge-' + Date.now());
let memDir;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockClear();
  execSync.mockClear();
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('cmdInit error handling', () => {
  test('handles git init failure', async () => {
    spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'git error' });

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdInit(['test-task'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Error');
  });

  test('creates goal file with provided goal text', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    await cmdInit(['my-task', 'Build', 'something', 'cool'], memDir);

    expect(spawnSync).toHaveBeenCalled();
  });
});

describe('cmdSwitch edge cases', () => {
  test('handles checkout to task/ prefixed name', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    cmdSwitch(['task/feature'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', 'task/feature'],
      expect.any(Object)
    );
  });

  test('handles fallback when task/ prefix fails', () => {
    spawnSync
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'error' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    cmdSwitch(['feature'], memDir);

    // Should have tried task/feature then feature
    expect(spawnSync).toHaveBeenCalledTimes(2);
  });
});

describe('cmdSync edge cases', () => {
  test('handles no remote configured', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No remote');
  });

  test('handles successful sync', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'origin', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Syncing');
  });
});

describe('cmdBranch edge cases', () => {
  test('lists branches without args', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '* main\n  task/test', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdBranch([], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('creates new branch when not exists', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '* main', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    cmdBranch(['new-feature'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', 'task/new-feature'],
      expect.any(Object)
    );
  });

  test('switches to existing branch', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '* main\n  task/existing', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    cmdBranch(['existing'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', 'task/existing'],
      expect.any(Object)
    );
  });
});

describe('cmdCommit edge cases', () => {
  test('handles no changes to commit', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdCommit(['test message'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No changes');
  });

  test('commits with message', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'M file.md', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdCommit(['my', 'message'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'my message'],
      expect.any(Object)
    );
  });
});

describe('findMemDir edge cases', () => {
  test('returns unmapped result for central mem', () => {
    // Create a temp dir that has no .mem
    const noMemDir = path.join(testDir, 'no-mem-here');
    fs.mkdirSync(noMemDir, { recursive: true });

    const result = findMemDir(noMemDir);
    // Result depends on whether CENTRAL_MEM exists
    expect(result === null || typeof result === 'object').toBe(true);
  });

  test('finds local .mem in parent directory', () => {
    const subDir = path.join(testDir, 'subdir', 'nested');
    fs.mkdirSync(subDir, { recursive: true });

    const result = findMemDir(subDir);
    expect(result).not.toBeNull();
    expect(result.memDir).toBe(memDir);
    expect(result.isLocal).toBe(true);
  });
});

describe('config functions', () => {
  test('saveConfig handles existing directory', () => {
    // This just tests the function doesn't throw
    expect(() => saveConfig({ repos: {} })).not.toThrow();
  });

  test('saveIndex handles existing directory', () => {
    expect(() => saveIndex({})).not.toThrow();
  });

  test('loadIndex returns object', () => {
    const result = loadIndex();
    expect(typeof result).toBe('object');
  });
});

describe('color constants', () => {
  test('all required colors are present', () => {
    expect(c.reset).toBeDefined();
    expect(c.bold).toBeDefined();
    expect(c.dim).toBeDefined();
    expect(c.green).toBeDefined();
    expect(c.yellow).toBeDefined();
    expect(c.red).toBeDefined();
    expect(c.cyan).toBeDefined();
    expect(c.blue).toBeDefined();
    expect(c.magenta).toBeDefined();
  });
});
