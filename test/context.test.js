/**
 * Tests for cmdContext function
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
  cmdContext,
  writeMemFile,
  readMemFile
} = require('../index.js');

const { spawnSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-context-' + Date.now());
let memDir;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockClear();
  jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('cmdContext', () => {
  test('prints warning when no memDir', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo found');
  });

  test('displays context output', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test-feature\n', stderr: '' });

    writeMemFile(memDir, 'goal.md', `---
task: test-feature
created: 2024-01-01
---

# Goal

Build a test feature
`);

    writeMemFile(memDir, 'state.md', `---
status: active
---

## Next Step

Write unit tests

## Checkpoints

- [x] 2024-01-01: Started project
`);

    writeMemFile(memDir, 'memory.md', `# Learnings

- 2024-01-01: Testing is important
`);

    writeMemFile(memDir, 'playbook.md', `# Playbook

- Always write tests first
`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Context');
    expect(output).toContain('Branch');
  });

  test('shows goal in context', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test\n', stderr: '' });

    writeMemFile(memDir, 'goal.md', `# Goal

Test goal text
`);
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Goal');
  });

  test('shows state in context', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test\n', stderr: '' });

    writeMemFile(memDir, 'goal.md', '# Goal\n\nTest');
    writeMemFile(memDir, 'state.md', `---
status: active
---

## Next Step

Do something
`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('State');
    expect(output).toContain('Do something');
  });

  test('shows learnings in context', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test\n', stderr: '' });

    writeMemFile(memDir, 'goal.md', '# Goal\n\nTest');
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');
    writeMemFile(memDir, 'memory.md', `# Learnings

- 2024-01-01: Important insight
`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Learnings');
    expect(output).toContain('Important insight');
  });

  test('shows playbook in context', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test\n', stderr: '' });

    writeMemFile(memDir, 'goal.md', '# Goal\n\nTest');
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');
    writeMemFile(memDir, 'playbook.md', `# Playbook

- Global learning
`);

    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Playbook');
    expect(output).toContain('Global learning');
  });

  test('handles missing files gracefully', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test\n', stderr: '' });

    // Don't create any files
    const consoleSpy = jest.spyOn(console, 'log');
    cmdContext(memDir);

    // Should not throw
    expect(consoleSpy).toHaveBeenCalled();
  });
});
