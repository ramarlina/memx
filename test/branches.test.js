/**
 * Tests for branch coverage
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
  cmdConstraint,
  cmdProgress,
  cmdCriteria,
  cmdBranch,
  cmdCommit,
  cmdSwitch,
  cmdSync,
  cmdWake,
  cmdCronExport,
  writeMemFile,
  readMemFile,
  CENTRAL_MEM,
  loadIndex,
  saveIndex,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-branches-' + Date.now());
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

describe('cmdInit edge cases', () => {
  test('handles branch creation error', async () => {
    spawnSync.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'branch exists' });

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdInit(['existing-task'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Error');
  });

  test('creates task with goal in existing repo', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdInit(['my-task', 'Build', 'something'], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Created task branch');
    expect(output).toContain('Build something');
  });

  test('shows usage when no name provided with existing memDir', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    await cmdInit([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });
});

describe('cmdConstraint edge cases', () => {
  test('shows constraint not found for invalid number', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal\n\n## Constraints\n\n- First\n- Second`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdConstraint(['remove', '99'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('not found');
  });

  test('adds constraint to new section', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal\n\nTest goal`);

    cmdConstraint(['add', 'New constraint'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('## Constraints');
    expect(content).toContain('New constraint');
  });
});

describe('cmdProgress edge cases', () => {
  test('shows warning when no Definition of Done section', () => {
    writeMemFile(memDir, 'goal.md', `# Goal\n\nJust a goal without criteria`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdProgress([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No "Definition of Done"');
  });

  test('shows progress with mixed criteria', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

Test goal

## Definition of Done

- [x] First done
- [ ] Second not done
- [x] Third done

## Progress: 0%`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdProgress([], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    // Should show 66% (2 of 3)
    expect(output).toMatch(/66%|67%/);
  });
});

describe('cmdCriteria edge cases', () => {
  test('checks criterion by number', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

## Definition of Done

- [ ] First
- [ ] Second
- [ ] Third

## Progress: 0%`);

    cmdCriteria(['check', '2'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('- [ ] First');
    expect(content).toContain('- [x] Second');
    expect(content).toContain('- [ ] Third');
  });

  test('adds criterion with add command', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

## Definition of Done

- [ ] First

## Progress: 0%`);

    cmdCriteria(['add', 'New', 'criterion'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('New criterion');
  });
});

describe('cmdBranch edge cases', () => {
  test('lists branches when no args', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '  main\n* task/test', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdBranch([], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('creates branch with task/ prefix already present', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '  main', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdBranch(['task/already-prefixed'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', 'task/already-prefixed'],
      expect.any(Object)
    );
  });
});

describe('cmdCommit edge cases', () => {
  test('shows warning when nothing to commit', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' }); // git status shows nothing

    const consoleSpy = jest.spyOn(console, 'log');
    cmdCommit(['test message'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No changes');
  });

  test('commits with custom message', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'M file.md', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdCommit(['Custom', 'commit', 'message'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'Custom commit message'],
      expect.any(Object)
    );
  });
});

describe('cmdSync edge cases', () => {
  test('shows warning when no remote', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' }); // no remote

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No remote');
  });
});

describe('cmdWake edge cases', () => {
  test('clears wake schedule', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: active\nwake: every 15m\n---\n\n');

    cmdWake(['clear'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).not.toContain('wake:');
  });

  test('sets wake schedule without --run', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');

    cmdWake(['every', '30m'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('wake: every 30m');
  });
});

describe('cmdCronExport edge cases', () => {
  test('shows no wake when state.md missing', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdCronExport(memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No wake');
  });

  test('exports with default wake command', () => {
    writeMemFile(memDir, 'state.md', '---\nwake: every 1h\n---\n\n');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdCronExport(memDir);

    const output = consoleSpy.mock.calls[0][0];
    // Should contain cron expression and mem context command
    expect(output).toContain('mem context');
  });
});
