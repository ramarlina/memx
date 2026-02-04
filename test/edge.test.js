/**
 * Edge case tests to increase coverage
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
  cmdContext,
  cmdProgress,
  cmdConstraint,
  cmdCriteria,
  writeMemFile,
  readMemFile,
  parseFrontmatter,
  serializeFrontmatter,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-edge-' + Date.now());
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

describe('cmdStatus edge cases', () => {
  test('shows status with all sections', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });

    writeMemFile(memDir, 'goal.md', `---
task: test
status: active
created: 2024-01-01
---

# Goal

Build something amazing

## Definition of Done

- [x] First criterion
- [ ] Second criterion

## Progress: 50%`);

    writeMemFile(memDir, 'state.md', `---
status: active
---

# State

## Next Step

Continue building

## Checkpoints

- [x] Started
- [x] First milestone`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdStatus(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('test');
  });

  test('shows blocked status', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/blocked-test', stderr: '' });

    writeMemFile(memDir, 'state.md', `---
status: blocked
blocker: Waiting for review
---

# State`);

    writeMemFile(memDir, 'goal.md', `---
task: blocked-test
---

# Goal

Test`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdStatus(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('blocked');
  });

  test('shows done status', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/done-test', stderr: '' });

    writeMemFile(memDir, 'state.md', `---
status: done
---

# State`);

    writeMemFile(memDir, 'goal.md', `---
task: done-test
---

# Goal

Completed task`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdStatus(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('cmdGoal edge cases', () => {
  test('updates existing goal text', () => {
    writeMemFile(memDir, 'goal.md', `---
task: test
---

# Goal

Old goal text

## Definition of Done

- [ ] Criterion`);

    cmdGoal(['New', 'goal', 'text'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('New goal text');
  });
});

describe('cmdNext edge cases', () => {
  test('updates existing next step', () => {
    writeMemFile(memDir, 'state.md', `---
status: active
---

# State

## Next Step

Old next step

## Checkpoints

- [x] Started`);

    cmdNext(['New', 'next', 'step'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('New next step');
  });
});

describe('cmdCheckpoint edge cases', () => {
  test('adds checkpoint with existing ones', () => {
    writeMemFile(memDir, 'state.md', `---
status: active
---

# State

## Next Step

Continue

## Checkpoints

- [x] First checkpoint`);

    cmdCheckpoint(['Second', 'checkpoint'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('Second checkpoint');
    expect(content).toContain('First checkpoint');
  });
});

describe('cmdLearn edge cases', () => {
  test('learns to task memory', () => {
    writeMemFile(memDir, 'memory.md', '# Learnings\n\n');

    cmdLearn(['Task', 'specific', 'insight'], memDir);

    const content = readMemFile(memDir, 'memory.md');
    expect(content).toContain('Task specific insight');
  });

  test('creates memory.md if not exists', () => {
    cmdLearn(['First', 'learning'], memDir);

    const content = readMemFile(memDir, 'memory.md');
    expect(content).toContain('First learning');
  });
});

describe('cmdContext edge cases', () => {
  test('outputs full context', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/context-test', stderr: '' });

    writeMemFile(memDir, 'goal.md', `---
task: context-test
created: 2024-01-01
---

# Goal

Test goal for context

## Constraints

- Be fast

## Definition of Done

- [ ] Done criterion`);

    writeMemFile(memDir, 'state.md', `---
status: active
---

# State

## Next Step

Work on it

## Checkpoints

- [x] Started`);

    writeMemFile(memDir, 'memory.md', `# Learnings

- 2024-01-01: First learning`);

    writeMemFile(memDir, 'playbook.md', `# Playbook

- Global rule`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('context-test');
    expect(output).toContain('Test goal for context');
    expect(output).toContain('First learning');
    expect(output).toContain('Global rule');
  });
});

describe('cmdProgress edge cases', () => {
  test('calculates and updates progress', () => {
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Definition of Done

- [x] First
- [x] Second
- [ ] Third
- [ ] Fourth

## Progress: 0%`);

    cmdProgress([], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('50%');
  });

  test('shows 100% when all done', () => {
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Definition of Done

- [x] First
- [x] Second

## Progress: 0%`);

    cmdProgress([], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('100%');
  });
});

describe('cmdConstraint edge cases', () => {
  test('lists multiple constraints', () => {
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Constraints

- No breaking changes
- Test coverage > 80%
- Performance < 100ms`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdConstraint([], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No breaking changes');
    expect(output).toContain('Test coverage');
    expect(output).toContain('Performance');
  });
});

describe('cmdCriteria edge cases', () => {
  test('shows criteria when present', () => {
    writeMemFile(memDir, 'goal.md', `# Goal

Test

## Definition of Done

- [ ] First criterion
- [x] Second criterion done
- [ ] Third criterion

## Progress: 33%`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdCriteria([], memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('criteria');
  });
});

describe('parseFrontmatter edge cases', () => {
  test('parses frontmatter with dates', () => {
    const content = `---
task: test
created: 2024-01-15
status: active
---

# Goal

Body text`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.task).toBe('test');
    expect(result.frontmatter.created).toBe('2024-01-15');
    expect(result.frontmatter.status).toBe('active');
    expect(result.body).toContain('Body text');
  });

  test('handles frontmatter with boolean-like values', () => {
    const content = `---
active: true
archived: false
---

Content`;

    const result = parseFrontmatter(content);
    // Simple YAML parser keeps values as strings
    expect(result.frontmatter.active).toBe('true');
    expect(result.frontmatter.archived).toBe('false');
  });
});

describe('serializeFrontmatter edge cases', () => {
  test('serializes frontmatter with date', () => {
    const result = serializeFrontmatter(
      { task: 'test', created: '2024-01-15' },
      '# Goal\n\nBody'
    );

    expect(result).toContain('task: test');
    expect(result).toContain('created: 2024-01-15');
    expect(result).toContain('# Goal');
  });

  test('serializes frontmatter with status', () => {
    const result = serializeFrontmatter(
      { status: 'blocked', blocker: 'Waiting for API' },
      '# State'
    );

    expect(result).toContain('status: blocked');
    expect(result).toContain('blocker: Waiting for API');
  });
});
