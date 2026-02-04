/**
 * Tests for command functions in index.js
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
  cmdStatus,
  cmdGoal,
  cmdNext,
  cmdCheckpoint,
  cmdLearn,
  cmdSwitch,
  cmdSync,
  cmdHistory,
  cmdStuck,
  cmdQuery,
  cmdPlaybook,
  cmdLearnings,
  cmdPromote,
  cmdConstraint,
  cmdProgress,
  cmdCriteria,
  cmdBranch,
  cmdCommit,
  cmdSet,
  cmdGet,
  cmdAppend,
  cmdLog,
  readMemFile,
  writeMemFile,
  parseFrontmatter,
  git,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

// Test directory setup
const testDir = path.join(os.tmpdir(), 'memx-test-commands-' + Date.now());
let memDir;

beforeEach(() => {
  // Create fresh test directory
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });

  // Reset mocks
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

describe('cmdStatus', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdStatus(null);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('No .mem repo found');
  });

  test('displays status when memDir exists', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test\n', stderr: '' });

    writeMemFile(memDir, 'goal.md', `---
task: test
---

# Goal

Test goal
`);
    writeMemFile(memDir, 'state.md', `---
status: active
---

## Next Step

Do something
`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdStatus(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('cmdGoal', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdGoal([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('displays current goal when no args', () => {
    writeMemFile(memDir, 'goal.md', '# Goal\n\nTest goal content');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdGoal([], memDir);
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain('Test goal content');
  });

  test('sets new goal when args provided', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', '---\ntask: test\n---\n\n# Old Goal');

    cmdGoal(['New', 'goal', 'text'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('New goal text');
  });
});

describe('cmdNext', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdNext([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('displays current next step when no args', () => {
    writeMemFile(memDir, 'state.md', `---
status: active
---

## Next Step

Implement feature X
`);
    const consoleSpy = jest.spyOn(console, 'log');
    cmdNext([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Implement feature X');
  });

  test('sets new next step when args provided', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', `---
status: active
---

## Next Step

Old step
`);

    cmdNext(['New', 'step', 'here'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('New step here');
  });
});

describe('cmdCheckpoint', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdCheckpoint([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('requires message argument', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdCheckpoint([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('adds checkpoint to state.md', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', `---
status: active
---

## Checkpoints

- [ ] Started
`);

    cmdCheckpoint(['Completed', 'first', 'task'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('Completed first task');
    expect(content).toContain('[x]');
  });
});

describe('cmdLearn', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearn([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('requires insight argument', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearn([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('adds learning to memory.md', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'memory.md', '# Learnings\n\n');

    cmdLearn(['Always', 'test', 'first'], memDir);

    const content = readMemFile(memDir, 'memory.md');
    expect(content).toContain('Always test first');
  });

  test('adds global learning to playbook.md with -g flag', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n');

    cmdLearn(['-g', 'Global', 'insight'], memDir);

    const content = readMemFile(memDir, 'playbook.md');
    expect(content).toContain('Global insight');
  });
});

describe('cmdStuck', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdStuck([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('shows no blockers when status is clear', () => {
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdStuck([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No blockers');
  });

  test('sets blocker status', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');

    cmdStuck(['Waiting', 'for', 'API'], memDir);

    const content = readMemFile(memDir, 'state.md');
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.blocker).toBe('Waiting for API');
    expect(frontmatter.status).toBe('blocked');
  });

  test('clears blocker with "clear" argument', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: blocked\nblocker: Some issue\n---\n\n');

    cmdStuck(['clear'], memDir);

    const content = readMemFile(memDir, 'state.md');
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.blocker).toBeUndefined();
    expect(frontmatter.status).toBe('active');
  });
});

describe('cmdPlaybook', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdPlaybook(null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('displays playbook content', () => {
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n- Learning 1\n- Learning 2');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdPlaybook(memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Playbook');
  });

  test('shows message when no playbook', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdPlaybook(memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No playbook');
  });
});

describe('cmdLearnings', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearnings([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('shows no learnings message when empty', () => {
    writeMemFile(memDir, 'memory.md', '# Learnings\n\n');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearnings([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No learnings');
  });

  test('lists task learnings with numbers', () => {
    writeMemFile(memDir, 'memory.md', '# Learnings\n\n- 2024-01-01: First\n- 2024-01-02: Second');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearnings([], memDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Task Learnings');
  });

  test('lists global learnings with -g flag', () => {
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n- Global learning');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdLearnings(['-g'], memDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Playbook');
  });
});

describe('cmdPromote', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdPromote([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('requires number argument', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdPromote([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('promotes learning to playbook', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'memory.md', '# Learnings\n\n- 2024-01-01: Important insight');
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n');

    cmdPromote(['1'], memDir);

    const playbook = readMemFile(memDir, 'playbook.md');
    expect(playbook).toContain('Important insight');
  });

  test('rejects invalid number', () => {
    writeMemFile(memDir, 'memory.md', '# Learnings\n\n- One learning');
    const consoleSpy = jest.spyOn(console, 'log');
    cmdPromote(['5'], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Invalid number');
  });
});

describe('cmdSwitch', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdSwitch([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('requires name argument', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdSwitch([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('switches to task branch', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    cmdSwitch(['feature'], memDir);
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', 'task/feature'],
      expect.any(Object)
    );
  });
});

describe('cmdHistory', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdHistory(null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('shows git log', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'abc123 init: test\ndef456 checkpoint: done', stderr: '' });
    const consoleSpy = jest.spyOn(console, 'log');
    cmdHistory(memDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('History');
  });
});

describe('cmdSync', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('warns when no remote configured', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    const consoleSpy = jest.spyOn(console, 'log');
    cmdSync(memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('No remote configured');
  });
});

describe('cmdQuery', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdQuery([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('requires search argument', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdQuery([], memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });
});

describe('cmdProgress', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdProgress([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('shows progress bar', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Definition of Done

- [x] First
- [ ] Second
- [ ] Third

## Progress: 0%
`);
    const consoleSpy = jest.spyOn(console, 'log');
    cmdProgress([], memDir);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Progress');
    expect(output).toContain('%');
  });
});

describe('cmdCriteria', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdCriteria([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('adds new criterion', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Definition of Done

- [ ] Existing
`);
    cmdCriteria(['add', 'New', 'criterion'], memDir);
    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('New criterion');
  });
});

describe('cmdConstraint', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdConstraint([], null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('adds constraint', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', `# Goal

## Constraints

`);
    cmdConstraint(['add', 'Must', 'be', 'fast'], memDir);
    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('Must be fast');
  });
});

describe('Primitive commands', () => {
  describe('cmdBranch', () => {
    test('lists branches when no args', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '  main\n* task/feature', stderr: '' });
      const consoleSpy = jest.spyOn(console, 'log');
      cmdBranch([], memDir);
      expect(spawnSync).toHaveBeenCalled();
    });

    test('creates new branch', () => {
      spawnSync
        .mockReturnValueOnce({ status: 0, stdout: '  main', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

      cmdBranch(['new-feature'], memDir);
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        ['checkout', '-b', 'task/new-feature'],
        expect.any(Object)
      );
    });
  });

  describe('cmdCommit', () => {
    test('commits changes with message', () => {
      spawnSync
        .mockReturnValueOnce({ status: 0, stdout: 'M file.md', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

      cmdCommit(['Test', 'commit'], memDir);
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'Test commit'],
        expect.any(Object)
      );
    });

    test('shows nothing to commit when no changes', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      const consoleSpy = jest.spyOn(console, 'log');
      cmdCommit([], memDir);
      expect(consoleSpy.mock.calls[0][0]).toContain('No changes');
    });
  });

  describe('cmdSet', () => {
    test('prints warning when no memDir', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdSet([], null);
      expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
    });

    test('requires key and value', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdSet(['key'], memDir);
      expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
    });

    test('sets value in frontmatter', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\nBody');

      cmdSet(['mykey', 'myvalue'], memDir);

      const content = readMemFile(memDir, 'state.md');
      expect(content).toContain('mykey: myvalue');
    });
  });

  describe('cmdGet', () => {
    test('prints warning when no memDir', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdGet([], null);
      expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
    });

    test('requires key argument', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdGet([], memDir);
      expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
    });

    test('gets value from frontmatter', () => {
      writeMemFile(memDir, 'state.md', '---\nstatus: active\nmykey: myvalue\n---\n\n');
      const consoleSpy = jest.spyOn(console, 'log');
      cmdGet(['mykey'], memDir);
      expect(consoleSpy.mock.calls[0][0]).toBe('myvalue');
    });

    test('shows not set for missing key', () => {
      writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');
      const consoleSpy = jest.spyOn(console, 'log');
      cmdGet(['missing'], memDir);
      expect(consoleSpy.mock.calls[0][0]).toContain('Not set');
    });
  });

  describe('cmdAppend', () => {
    test('prints warning when no memDir', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdAppend([], null);
      expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
    });

    test('requires list and item arguments', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdAppend(['list'], memDir);
      expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
    });

    test('appends to learnings list', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      writeMemFile(memDir, 'memory.md', '# Learnings\n\n');

      cmdAppend(['learnings', 'New', 'item'], memDir);

      const content = readMemFile(memDir, 'memory.md');
      expect(content).toContain('New item');
    });

    test('appends to playbook list', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      writeMemFile(memDir, 'playbook.md', '# Playbook\n\n');

      cmdAppend(['playbook', 'Global', 'insight'], memDir);

      const content = readMemFile(memDir, 'playbook.md');
      expect(content).toContain('Global insight');
    });

    test('rejects unknown list name', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdAppend(['unknown', 'item'], memDir);
      expect(consoleSpy.mock.calls[0][0]).toContain('Unknown list');
    });
  });

  describe('cmdLog', () => {
    test('prints warning when no memDir', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      cmdLog(null);
      expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
    });

    test('shows git log', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'abc123 commit msg', stderr: '' });
      const consoleSpy = jest.spyOn(console, 'log');
      cmdLog(memDir);
      expect(consoleSpy.mock.calls[0][0]).toContain('abc123');
    });
  });
});

