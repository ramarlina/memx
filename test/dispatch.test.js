/**
 * Tests for main dispatcher and edge cases
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
  cmdSwitch,
  cmdLearn,
  cmdLearnings,
  cmdPlaybook,
  cmdHistory,
  cmdLog,
  cmdQuery,
  writeMemFile,
  readMemFile,
  CENTRAL_MEM,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-dispatch-' + Date.now());
let memDir;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockReset();
  spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
  execSync.mockClear();
  jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('cmdBranch initialization', () => {
  test('switches to existing branch', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '  main\n  task/existing', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '  main\n  task/existing', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdBranch(['existing'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Switched to');
  });
});

describe('cmdCommit edge cases', () => {
  test('uses central mem when no memDir provided', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'M file.md', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    cmdCommit(['test'], null);

    // Should work with central mem if it exists
    expect(spawnSync).toHaveBeenCalled();
  });
});

describe('cmdSwitch edge cases', () => {
  test('switches to task branch without prefix', () => {
    spawnSync
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'not found' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSwitch(['feature'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Switched');
  });

  test('shows error when both attempts fail', () => {
    // Both with and without task/ prefix fail
    spawnSync
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'error1' })
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'error2' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSwitch(['nonexistent'], memDir);

    // The function tries task/nonexistent first, then nonexistent
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('shows usage when no args', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdSwitch([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });
});

describe('cmdLearn edge cases', () => {
  test('learns to playbook with -g flag', () => {
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n');

    cmdLearn(['-g', 'Global', 'insight'], memDir);

    const content = readMemFile(memDir, 'playbook.md');
    expect(content).toContain('Global insight');
  });

  test('shows usage when no text', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearn([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });
});

describe('cmdLearnings edge cases', () => {
  test('shows global learnings with -g flag', () => {
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n- Global rule 1\n- Global rule 2');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearnings(['-g'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Global');
  });
});

describe('cmdPlaybook edge cases', () => {
  test('creates playbook if empty', () => {
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdPlaybook(memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Playbook');
  });
});

describe('cmdHistory edge cases', () => {
  test('shows history with multiple commits', () => {
    spawnSync.mockReturnValue({
      status: 0,
      stdout: 'abc123 first commit\ndef456 second commit\nghi789 third commit',
      stderr: ''
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdHistory(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('History');
  });
});

describe('cmdLog edge cases', () => {
  test('shows formatted log', () => {
    spawnSync.mockReturnValue({
      status: 0,
      stdout: '* abc123 (HEAD -> task/test) first\n* def456 second',
      stderr: ''
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdLog(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles empty log', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdLog(memDir);

    expect(consoleSpy.mock.calls[0][0]).toBe('');
  });
});

describe('cmdQuery edge cases', () => {
  test('searches in all markdown files', () => {
    execSync.mockReturnValue('goal.md:5:Test match\nstate.md:10:Another match');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdQuery(['test'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('shows usage when no search term', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdQuery([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });
});
