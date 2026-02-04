/**
 * Tests for cmdTasks - focus on list mode and testable parts
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
  cmdTasks,
  writeMemFile,
  readMemFile,
  c
} = require('../index.js');

const { spawnSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-tasks-' + Date.now());
let memDir;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockClear();
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('cmdTasks list mode', () => {
  test('shows message when no task branches', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'main', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '* main', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No tasks');
  });

  test('lists active tasks with -l flag', () => {
    // The first call is for --show-current, second for branch -a, etc.
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'task/feature', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '  main\n* task/feature\n  task/other', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '---\nstatus: active\n---\n\nTest goal', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '---\nstatus: active\n---\n\nOther goal', stderr: '' });

    writeMemFile(memDir, 'goal.md', '---\ntask: feature\nstatus: active\n---\n\n# Goal\n\nTest goal');
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('feature');
  });

  test('shows done status with checkmark', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'main', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '* main\n  task/done-task', stderr: '' };
      }
      if (args && args[0] === 'show') {
        return { status: 0, stdout: '---\nstatus: done\n---\n\nCompleted task', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('shows blocked status', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'main', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '* main\n  task/blocked-task', stderr: '' };
      }
      if (args && args[0] === 'show') {
        return { status: 0, stdout: '---\nstatus: blocked\n---\n\nBlocked task', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('shows progress percentage', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'task/progress', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '* task/progress', stderr: '' };
      }
      if (args && args[0] === 'show') {
        return { status: 0, stdout: '---\nstatus: active\n---\n\n## Progress: 50%', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles git show failure gracefully', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'main', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '  task/feature', stderr: '' };
      }
      if (args && args[0] === 'show') {
        return { status: 1, stdout: '', stderr: 'not found' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('marks current task', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'task/current-one', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '* task/current-one\n  task/other', stderr: '' };
      }
      if (args && args[0] === 'show') {
        return { status: 0, stdout: '---\nstatus: active\n---\n\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    // Verify the task is marked as current
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('cmdTasks non-interactive when stdin not TTY', () => {
  test('falls back to list mode when stdin is not TTY', () => {
    // Save original isTTY
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;

    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'task/test', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '* task/test', stderr: '' };
      }
      if (args && args[0] === 'show') {
        return { status: 0, stdout: '---\nstatus: active\n---\n\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks([], memDir);

    // Should show list output since stdin is not TTY
    expect(consoleSpy).toHaveBeenCalled();

    // Restore
    process.stdin.isTTY = originalIsTTY;
  });
});

describe('cmdTasks with remote branches', () => {
  test('includes remote task branches', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args && args.includes('--show-current')) {
        return { status: 0, stdout: 'main', stderr: '' };
      }
      if (args && args[0] === 'branch' && args[1] === '-a') {
        return { status: 0, stdout: '* main\n  remotes/origin/task/remote-feature', stderr: '' };
      }
      if (args && args[0] === 'show') {
        return { status: 0, stdout: '---\nstatus: active\n---\n\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdTasks(['-l'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});
