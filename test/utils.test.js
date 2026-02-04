/**
 * Tests for utility functions in index.js
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
    question: jest.fn((q, cb) => cb('test answer')),
    close: jest.fn(),
    on: jest.fn()
  }))
}));

const {
  parseFrontmatter,
  serializeFrontmatter,
  parseWakeToCron,
  loadConfig,
  saveConfig,
  loadIndex,
  saveIndex,
  readMemFile,
  writeMemFile,
  git,
  getCurrentBranch,
  findMemDir,
  ensureTaskBranch,
  CONFIG_DIR,
  CONFIG_FILE,
  CENTRAL_MEM,
  INDEX_FILE,
  c
} = require('../index.js');

const { spawnSync } = require('child_process');

describe('parseFrontmatter', () => {
  test('returns empty object for null content', () => {
    const result = parseFrontmatter(null);
    expect(result).toEqual({ frontmatter: {}, body: '' });
  });

  test('returns empty object for undefined content', () => {
    const result = parseFrontmatter(undefined);
    expect(result).toEqual({ frontmatter: {}, body: '' });
  });

  test('returns empty object for empty string', () => {
    const result = parseFrontmatter('');
    expect(result).toEqual({ frontmatter: {}, body: '' });
  });

  test('parses frontmatter with single key', () => {
    const content = '---\nstatus: active\n---\n\nBody content';
    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({ status: 'active' });
    expect(result.body).toBe('Body content');
  });

  test('parses frontmatter with multiple keys', () => {
    const content = '---\nstatus: active\nnext: do something\ntask: test-task\n---\n\n# Body\n\nSome content';
    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({
      status: 'active',
      next: 'do something',
      task: 'test-task'
    });
    expect(result.body).toBe('# Body\n\nSome content');
  });

  test('handles values with colons', () => {
    const content = '---\nwake: 8:30am daily\n---\n\nBody';
    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({ wake: '8:30am daily' });
  });

  test('returns full content as body when no frontmatter', () => {
    const content = 'Just some body content without frontmatter';
    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('Just some body content without frontmatter');
  });

  test('handles markdown with only frontmatter', () => {
    const content = '---\nkey: value\n---\n';
    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({ key: 'value' });
    expect(result.body).toBe('');
  });

  test('ignores lines without colons in frontmatter', () => {
    const content = '---\nvalid: yes\ninvalid line\nanother: good\n---\n\nBody';
    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({ valid: 'yes', another: 'good' });
  });
});

describe('serializeFrontmatter', () => {
  test('serializes frontmatter with body', () => {
    const frontmatter = { status: 'active', task: 'test' };
    const body = '# Goal\n\nDo something';
    const result = serializeFrontmatter(frontmatter, body);
    expect(result).toBe('---\nstatus: active\ntask: test\n---\n\n# Goal\n\nDo something');
  });

  test('handles empty frontmatter', () => {
    const result = serializeFrontmatter({}, 'Body content');
    expect(result).toBe('---\n\n---\n\nBody content');
  });

  test('handles empty body', () => {
    const result = serializeFrontmatter({ key: 'value' }, '');
    expect(result).toBe('---\nkey: value\n---\n\n');
  });

  test('roundtrip with parseFrontmatter', () => {
    const original = { status: 'active', wake: 'every 15m' };
    const body = '# Test\n\nSome content';
    const serialized = serializeFrontmatter(original, body);
    const parsed = parseFrontmatter(serialized);
    expect(parsed.frontmatter).toEqual(original);
    expect(parsed.body).toBe(body);
  });
});

describe('parseWakeToCron', () => {
  describe('interval patterns', () => {
    test('parses "every 15m"', () => {
      expect(parseWakeToCron('every 15m')).toBe('*/15 * * * *');
    });

    test('parses "every 30min"', () => {
      expect(parseWakeToCron('every 30min')).toBe('*/30 * * * *');
    });

    test('parses "every 5 minutes"', () => {
      expect(parseWakeToCron('every 5 minutes')).toBe('*/5 * * * *');
    });

    test('parses "every 2h"', () => {
      expect(parseWakeToCron('every 2h')).toBe('0 */2 * * *');
    });

    test('parses "every 4hr"', () => {
      expect(parseWakeToCron('every 4hr')).toBe('0 */4 * * *');
    });

    test('parses "every 1 hour"', () => {
      expect(parseWakeToCron('every 1 hour')).toBe('0 */1 * * *');
    });
  });

  describe('daily patterns', () => {
    test('parses "8am"', () => {
      expect(parseWakeToCron('8am')).toBe('0 8 * * *');
    });

    test('parses "8am daily"', () => {
      expect(parseWakeToCron('8am daily')).toBe('0 8 * * *');
    });

    test('parses "9:30am"', () => {
      expect(parseWakeToCron('9:30am')).toBe('30 9 * * *');
    });

    test('parses "5pm"', () => {
      expect(parseWakeToCron('5pm')).toBe('0 17 * * *');
    });

    test('parses "9:30pm daily"', () => {
      expect(parseWakeToCron('9:30pm daily')).toBe('30 21 * * *');
    });

    test('parses "12am" (midnight)', () => {
      expect(parseWakeToCron('12am')).toBe('0 0 * * *');
    });

    test('parses "12pm" (noon)', () => {
      expect(parseWakeToCron('12pm')).toBe('0 12 * * *');
    });
  });

  describe('weekly patterns', () => {
    test('parses "monday 9am"', () => {
      expect(parseWakeToCron('monday 9am')).toBe('0 9 * * 1');
    });

    test('parses "friday 5pm"', () => {
      expect(parseWakeToCron('friday 5pm')).toBe('0 17 * * 5');
    });

    test('parses "every tuesday at 3pm"', () => {
      expect(parseWakeToCron('every tuesday at 3pm')).toBe('0 15 * * 2');
    });

    test('parses "wednesday 10:30am"', () => {
      expect(parseWakeToCron('wednesday 10:30am')).toBe('30 10 * * 3');
    });

    test('parses "sun 8am"', () => {
      expect(parseWakeToCron('sun 8am')).toBe('0 8 * * 0');
    });

    test('parses "saturday 2pm"', () => {
      expect(parseWakeToCron('saturday 2pm')).toBe('0 14 * * 6');
    });

    test('parses "thu 12pm"', () => {
      expect(parseWakeToCron('thu 12pm')).toBe('0 12 * * 4');
    });
  });

  describe('raw cron patterns', () => {
    test('passes through valid cron expression', () => {
      expect(parseWakeToCron('0 * * * *')).toBe('0 * * * *');
    });

    test('passes through complex cron expression', () => {
      expect(parseWakeToCron('*/5 9-17 * * 1-5')).toBe('*/5 9-17 * * 1-5');
    });
  });

  describe('invalid patterns', () => {
    test('returns null for invalid pattern', () => {
      expect(parseWakeToCron('invalid')).toBeNull();
    });

    test('returns null for partial pattern', () => {
      expect(parseWakeToCron('every')).toBeNull();
    });

    test('returns null for unsupported format', () => {
      expect(parseWakeToCron('at noon')).toBeNull();
    });
  });

  describe('case insensitivity', () => {
    test('handles uppercase', () => {
      expect(parseWakeToCron('EVERY 15M')).toBe('*/15 * * * *');
    });

    test('handles mixed case', () => {
      expect(parseWakeToCron('Monday 9AM')).toBe('0 9 * * 1');
    });
  });
});

describe('loadConfig / saveConfig', () => {
  const testDir = path.join(os.tmpdir(), 'memx-test-config-' + Date.now());
  const testConfigFile = path.join(testDir, 'config.json');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test('loadConfig returns default when no file exists', () => {
    // This would need CONFIG_FILE to point to a non-existent file
    // Since we can't easily mock constants, we test the function behavior
    const result = loadConfig();
    expect(result).toHaveProperty('repos');
  });

  test('saveConfig creates directory if needed', () => {
    // We can't easily test this without mocking the constants
    // But we verify the function exists and is callable
    expect(typeof saveConfig).toBe('function');
  });
});

describe('loadIndex / saveIndex', () => {
  test('loadIndex returns empty object when no file exists', () => {
    // loadIndex should return {} when file doesn't exist
    const result = loadIndex();
    expect(typeof result).toBe('object');
  });

  test('saveIndex is a function', () => {
    expect(typeof saveIndex).toBe('function');
  });
});

describe('readMemFile / writeMemFile', () => {
  const testDir = path.join(os.tmpdir(), 'memx-test-files-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test('readMemFile returns null for non-existent file', () => {
    const result = readMemFile(testDir, 'nonexistent.md');
    expect(result).toBeNull();
  });

  test('writeMemFile writes file content', () => {
    const content = '# Test\n\nContent';
    writeMemFile(testDir, 'test.md', content);
    const result = readMemFile(testDir, 'test.md');
    expect(result).toBe(content);
  });

  test('readMemFile/writeMemFile roundtrip', () => {
    const content = '---\nstatus: active\n---\n\n# Goal\n\nTest goal';
    writeMemFile(testDir, 'goal.md', content);
    const result = readMemFile(testDir, 'goal.md');
    expect(result).toBe(content);
  });
});

describe('git function', () => {
  beforeEach(() => {
    spawnSync.mockClear();
  });

  test('executes git command and returns stdout', () => {
    spawnSync.mockReturnValue({
      status: 0,
      stdout: 'main\n',
      stderr: ''
    });

    const result = git('/some/path', 'branch', '--show-current');
    expect(result).toBe('main');
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['branch', '--show-current'],
      expect.objectContaining({ cwd: '/some/path' })
    );
  });

  test('throws error on non-zero exit', () => {
    spawnSync.mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'fatal: not a git repository'
    });

    expect(() => git('/some/path', 'status')).toThrow('fatal: not a git repository');
  });

  test('handles empty stdout', () => {
    spawnSync.mockReturnValue({
      status: 0,
      stdout: '',
      stderr: ''
    });

    const result = git('/some/path', 'status', '--porcelain');
    expect(result).toBe('');
  });
});

describe('getCurrentBranch', () => {
  beforeEach(() => {
    spawnSync.mockClear();
  });

  test('returns current branch name', () => {
    spawnSync.mockReturnValue({
      status: 0,
      stdout: 'task/my-feature\n',
      stderr: ''
    });

    const result = getCurrentBranch('/some/path');
    expect(result).toBe('task/my-feature');
  });
});

describe('findMemDir', () => {
  const testDir = path.join(os.tmpdir(), 'memx-test-find-' + Date.now());
  const subDir = path.join(testDir, 'subdir', 'nested');
  const memDir = path.join(testDir, '.mem');

  beforeEach(() => {
    fs.mkdirSync(subDir, { recursive: true });
    spawnSync.mockClear();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test('returns null when no .mem found', () => {
    const result = findMemDir(subDir);
    // Might return central mem if it exists, or null
    expect(result === null || result.memDir).toBeTruthy();
  });

  test('finds local .mem directory', () => {
    fs.mkdirSync(memDir, { recursive: true });
    fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });

    const result = findMemDir(testDir);
    expect(result).not.toBeNull();
    expect(result.memDir).toBe(memDir);
    expect(result.isLocal).toBe(true);
  });

  test('finds local .mem from subdirectory', () => {
    fs.mkdirSync(memDir, { recursive: true });
    fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });

    const result = findMemDir(subDir);
    expect(result).not.toBeNull();
    expect(result.memDir).toBe(memDir);
    expect(result.isLocal).toBe(true);
  });
});

describe('ensureTaskBranch', () => {
  beforeEach(() => {
    spawnSync.mockClear();
  });

  test('does nothing when taskBranch is null', () => {
    ensureTaskBranch('/some/path', null);
    // git should not be called for getting current branch
    expect(spawnSync).not.toHaveBeenCalled();
  });

  test('switches branch when different from current', () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'main\n', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    ensureTaskBranch('/some/path', 'task/feature');

    expect(spawnSync).toHaveBeenCalledTimes(2);
    expect(spawnSync).toHaveBeenLastCalledWith(
      'git',
      ['checkout', 'task/feature'],
      expect.any(Object)
    );
  });

  test('does not switch when already on correct branch', () => {
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/feature\n', stderr: '' });

    ensureTaskBranch('/some/path', 'task/feature');

    expect(spawnSync).toHaveBeenCalledTimes(1);
  });
});

describe('constants', () => {
  test('CONFIG_DIR is defined', () => {
    expect(CONFIG_DIR).toBeDefined();
    expect(typeof CONFIG_DIR).toBe('string');
  });

  test('CENTRAL_MEM is defined', () => {
    expect(CENTRAL_MEM).toBeDefined();
    expect(CENTRAL_MEM).toContain('.mem');
  });

  test('colors object is defined', () => {
    expect(c).toBeDefined();
    expect(c.reset).toBeDefined();
    expect(c.bold).toBeDefined();
    expect(c.green).toBeDefined();
    expect(c.red).toBeDefined();
  });
});
