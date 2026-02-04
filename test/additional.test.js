/**
 * Additional tests to increase coverage
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
  cmdSwitch,
  cmdSync,
  cmdHistory,
  cmdStuck,
  cmdQuery,
  cmdConstraint,
  cmdProgress,
  cmdCriteria,
  cmdBranch,
  cmdCommit,
  writeMemFile,
  readMemFile,
  parseFrontmatter,
  git,
  getCurrentBranch,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-additional-' + Date.now());
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

describe('cmdSwitch additional tests', () => {
  test('tries without task/ prefix if first attempt fails', () => {
    spawnSync
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'error' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    cmdSwitch(['main'], memDir);

    expect(spawnSync).toHaveBeenCalledTimes(2);
  });

  test('handles both attempts failing', () => {
    spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'error' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSwitch(['nonexistent'], memDir);

    expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
  });

  test('handles task/ prefix in input', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    cmdSwitch(['task/feature'], memDir);
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', 'task/feature'],
      expect.any(Object)
    );
  });
});

describe('cmdSync additional tests', () => {
  test('handles sync with remote', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'origin', stderr: '' }) // git remote
      .mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' }) // getCurrentBranch
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' }) // pull
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' }); // push

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Syncing');
  });

  test('handles pull failure gracefully', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'origin', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' })
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'pull error' }) // pull fails
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' }); // push

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles push failure', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'origin', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'push error' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('cmdStuck additional tests', () => {
  test('shows existing blocker', () => {
    writeMemFile(memDir, 'state.md', '---\nstatus: blocked\nblocker: Waiting for review\n---\n\n');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdStuck([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Waiting for review');
  });
});

describe('cmdQuery additional tests', () => {
  test('shows results from grep', () => {
    execSync.mockReturnValue('goal.md:3:Test result');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdQuery(['test'], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Test result');
  });

  test('handles no results', () => {
    execSync.mockImplementation(() => { throw new Error('no matches'); });
    const consoleSpy = jest.spyOn(console, 'log');
    cmdQuery(['nonexistent'], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No matches');
  });
});

describe('cmdConstraint additional tests', () => {
  test('lists existing constraints', () => {
    writeMemFile(memDir, 'goal.md', `# Goal

## Constraints

- No breaking changes
- Test coverage > 80%
`);
    const consoleSpy = jest.spyOn(console, 'log');
    cmdConstraint([], memDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Constraints');
  });

  test('shows no constraints message', () => {
    writeMemFile(memDir, 'goal.md', '# Goal\n\n## Constraints\n\n');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdConstraint([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No constraints');
  });

  test('removes constraint by number', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

## Constraints

- First constraint
- Second constraint
`);
    const consoleSpy = jest.spyOn(console, 'log');
    cmdConstraint(['remove', '1'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).not.toContain('First constraint');
  });

  test('shows usage for unknown subcommand', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdConstraint(['unknown'], memDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('mem constraint');
  });
});

describe('cmdProgress additional tests', () => {
  test('shows message when no criteria defined', () => {
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Definition of Done

`);
    const consoleSpy = jest.spyOn(console, 'log');
    cmdProgress([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No criteria');
  });

  test('updates progress percentage in file', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Definition of Done

- [x] First
- [x] Second
- [x] Third

## Progress: 0%
`);
    const consoleSpy = jest.spyOn(console, 'log');
    cmdProgress([], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('100%');
  });

  test('handles goal.md not found', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdProgress([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No goal.md');
  });
});

describe('cmdCriteria additional tests', () => {
  test('shows usage when no args', () => {
    writeMemFile(memDir, 'goal.md', '# Goal\n\n## Definition of Done\n\n- [ ] Test');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdCriteria([], memDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('mem criteria');
  });

  test('marks criterion complete with check subcommand', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

## Definition of Done

- [ ] First
- [ ] Second

## Progress: 0%
`);
    cmdCriteria(['check', '1'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('- [x] First');
  });

  test('handles goal.md not found', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdCriteria(['add', 'Test'], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No goal.md');
  });
});

describe('cmdBranch additional tests', () => {
  test('switches to existing branch', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '  main\n  task/existing', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdBranch(['existing'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', 'task/existing'],
      expect.any(Object)
    );
  });

  test('handles branch operation error', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '  main', stderr: '' })
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'error' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdBranch(['new-branch'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles task/ prefix in branch name', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '  main', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    cmdBranch(['task/my-feature'], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', 'task/my-feature'],
      expect.any(Object)
    );
  });
});

describe('cmdCommit additional tests', () => {
  test('uses default message when none provided', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'M file.md', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    cmdCommit([], memDir);

    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'checkpoint'],
      expect.any(Object)
    );
  });

  test('handles commit error', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'M file.md', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'commit failed' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdCommit(['test'], memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('git helper additional tests', () => {
  test('handles git error with empty stderr', () => {
    spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '' });
    expect(() => git(memDir, 'status')).toThrow('Git command failed');
  });

  test('handles null stdout', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: null, stderr: '' });
    const result = git(memDir, 'status');
    expect(result).toBe('');
  });
});

describe('getCurrentBranch', () => {
  test('returns branch name', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'main\n', stderr: '' });
    const result = getCurrentBranch(memDir);
    expect(result).toBe('main');
  });
});
