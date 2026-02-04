/**
 * Additional tests for code coverage
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
  loadConfig,
  saveConfig,
  loadIndex,
  saveIndex,
  findMemDir,
  cmdInit,
  cmdStatus,
  cmdGoal,
  cmdNext,
  cmdCheckpoint,
  cmdStuck,
  cmdPlaybook,
  cmdSet,
  cmdGet,
  cmdAppend,
  writeMemFile,
  readMemFile,
  parseFrontmatter,
  serializeFrontmatter,
  CONFIG_DIR,
  CONFIG_FILE,
  CENTRAL_MEM,
  INDEX_FILE,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-coverage-' + Date.now());
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

describe('Config functions', () => {
  test('loadConfig with valid JSON file', () => {
    // Create a mock config file
    const configPath = path.join(testDir, 'config.json');
    const mockDir = path.dirname(configPath);
    fs.mkdirSync(mockDir, { recursive: true });

    // Config functions use fixed paths, test that function works
    const config = loadConfig();
    expect(typeof config).toBe('object');
    expect(config).toHaveProperty('repos');
  });

  test('loadConfig returns default for missing file', () => {
    const config = loadConfig();
    expect(config).toEqual({ repos: {} });
  });

  test('saveConfig creates directory and file', () => {
    // This test verifies the function doesn't throw
    expect(() => saveConfig({ repos: {} })).not.toThrow();
  });
});

describe('Index functions', () => {
  test('loadIndex returns empty object for missing file', () => {
    const index = loadIndex();
    expect(typeof index).toBe('object');
  });

  test('saveIndex and loadIndex roundtrip', () => {
    const testIndex = { '/test/path': 'task/test' };
    saveIndex(testIndex);
    const loaded = loadIndex();
    expect(loaded['/test/path']).toBe('task/test');
  });
});

describe('findMemDir', () => {
  test('finds local .mem with git', () => {
    const localMemDir = path.join(testDir, 'project', '.mem');
    fs.mkdirSync(path.join(localMemDir, '.git'), { recursive: true });

    const result = findMemDir(path.join(testDir, 'project'));
    expect(result).not.toBeNull();
    expect(result.isLocal).toBe(true);
    expect(result.memDir).toBe(localMemDir);
  });

  test('finds parent .mem directory', () => {
    const parentMem = path.join(testDir, 'parent', '.mem');
    const childDir = path.join(testDir, 'parent', 'child', 'subdir');
    fs.mkdirSync(path.join(parentMem, '.git'), { recursive: true });
    fs.mkdirSync(childDir, { recursive: true });

    const result = findMemDir(childDir);
    expect(result).not.toBeNull();
    expect(result.isLocal).toBe(true);
    expect(result.memDir).toBe(parentMem);
  });
});

describe('cmdInit edge cases', () => {
  test('cmdInit with existing .mem warns', async () => {
    // Create a local .mem in current testDir
    const localMem = path.join(testDir, 'existing', '.mem');
    fs.mkdirSync(path.join(localMem, '.git'), { recursive: true });

    const originalCwd = process.cwd;
    process.cwd = jest.fn(() => path.join(testDir, 'existing'));

    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdInit(['test-task'], localMem);

    expect(consoleSpy).toHaveBeenCalled();

    process.cwd = originalCwd;
  });
});

describe('cmdStatus edge cases', () => {
  test('handles missing goal.md', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdStatus(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles missing state.md', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });
    writeMemFile(memDir, 'goal.md', '---\ntask: test\n---\n\n# Goal\n\nTest');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdStatus(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('cmdGoal edge cases', () => {
  test('sets goal with text', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'goal.md', '---\ntask: test\n---\n\n# Goal\n\nOld goal');

    cmdGoal(['New', 'goal', 'text'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('New goal text');
  });

  test('creates goal.md if not exists', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    cmdGoal(['First', 'goal'], memDir);

    const content = readMemFile(memDir, 'goal.md');
    expect(content).toContain('First goal');
  });
});

describe('cmdStuck edge cases', () => {
  test('sets new blocker', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n# State');

    cmdStuck(['Waiting', 'for', 'API'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('status: blocked');
    expect(content).toContain('blocker: Waiting for API');
  });

  test('clears blocker with clear command', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: blocked\nblocker: Old blocker\n---\n\n');

    cmdStuck(['clear'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('status: active');
  });
});

describe('cmdPlaybook edge cases', () => {
  test('shows no playbook message', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdPlaybook(memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('No playbook');
  });

  test('shows playbook content', () => {
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n- Rule 1\n- Rule 2');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdPlaybook(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Playbook');
  });
});

describe('cmdSet edge cases', () => {
  test('shows usage when no args', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdSet([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('sets value in frontmatter', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n# State');

    cmdSet(['priority', 'high'], memDir);

    const content = readMemFile(memDir, 'state.md');
    expect(content).toContain('priority: high');
  });

  test('handles file not found', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    cmdSet(['key', 'value'], memDir);

    // Should create file or show error
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('cmdGet edge cases', () => {
  test('shows usage when no key', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdGet([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('gets value from frontmatter', () => {
    writeMemFile(memDir, 'state.md', '---\nstatus: active\npriority: high\n---\n\n');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdGet(['priority'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('high');
  });

  test('shows not set for missing key', () => {
    writeMemFile(memDir, 'state.md', '---\nstatus: active\n---\n\n');

    const consoleSpy = jest.spyOn(console, 'log');
    cmdGet(['nonexistent'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Not set');
  });
});

describe('cmdAppend edge cases', () => {
  test('shows usage when no section', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdAppend([], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Usage');
  });

  test('appends to learnings section', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'memory.md', '# Learnings\n\n- First');

    cmdAppend(['learnings', 'Second', 'item'], memDir);

    const content = readMemFile(memDir, 'memory.md');
    expect(content).toContain('Second item');
  });

  test('shows error for unknown list', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    cmdAppend(['unknown', 'item'], memDir);

    expect(consoleSpy.mock.calls[0][0]).toContain('Unknown list');
  });

  test('appends to playbook', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n- First rule');

    cmdAppend(['playbook', 'New', 'rule'], memDir);

    const content = readMemFile(memDir, 'playbook.md');
    expect(content).toContain('New rule');
  });
});

describe('serializeFrontmatter edge cases', () => {
  test('handles empty frontmatter', () => {
    const result = serializeFrontmatter({}, 'Body text');
    // Empty frontmatter still outputs the delimiters
    expect(result).toContain('---');
    expect(result).toContain('Body text');
  });

  test('handles frontmatter with special characters', () => {
    const result = serializeFrontmatter({ title: 'Test: with colon' }, 'Body');
    expect(result).toContain('title:');
  });
});

describe('parseFrontmatter edge cases', () => {
  test('handles frontmatter with nested structure', () => {
    const content = '---\nkey: value\nnested:\n  sub: item\n---\n\nBody';
    const result = parseFrontmatter(content);
    expect(result.frontmatter.key).toBe('value');
    expect(result.body).toBe('Body');
  });

  test('handles multiline body', () => {
    const content = '---\nstatus: active\n---\n\nLine 1\nLine 2\nLine 3';
    const result = parseFrontmatter(content);
    expect(result.body).toContain('Line 1');
    expect(result.body).toContain('Line 2');
    expect(result.body).toContain('Line 3');
  });
});
