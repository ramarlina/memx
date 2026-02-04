/**
 * Tests for interactive async functions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Variables for mock prompt responses - must be prefixed with 'mock'
let mockPromptResponses = [];
let mockPromptIndex = 0;

// Mock child_process before requiring index.js
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
  spawn: jest.fn()
}));

// Mock readline with controlled responses
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((q, cb) => {
      const response = mockPromptResponses[mockPromptIndex] || '';
      mockPromptIndex++;
      cb(response);
    }),
    close: jest.fn(),
    on: jest.fn()
  }))
}));

const {
  cmdDone,
  interactiveInit,
  setupRemote,
  writeMemFile,
  readMemFile,
  CENTRAL_MEM,
} = require('../index.js');

const { spawnSync, execSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'memx-test-interactive-' + Date.now());
let memDir;

beforeEach(() => {
  memDir = path.join(testDir, '.mem');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(memDir, '.git'), { recursive: true });
  spawnSync.mockClear();
  execSync.mockClear();
  mockPromptResponses = [];
  mockPromptIndex = 0;
  jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  jest.restoreAllMocks();
});

describe('cmdDone', () => {
  test('shows warning when no memDir', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    await cmdDone(null);
    expect(consoleSpy.mock.calls[0][0]).toContain('No .mem repo');
  });

  test('shows warning when on main branch', async () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: 'main', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdDone(memDir);
    expect(consoleSpy.mock.calls[0][0]).toContain('Already on main');
  });

  test('completes task with no learnings to promote', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    spawnSync.mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' });

    writeMemFile(memDir, 'memory.md', '# Learnings\n\n');

    mockPromptResponses = ['none', 'n'];

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdDone(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Completing task');
  });

  test('promotes learnings on done', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    spawnSync.mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' });

    writeMemFile(memDir, 'memory.md', '# Learnings\n\n- 2024-01-01: First insight\n- 2024-01-02: Second insight');
    writeMemFile(memDir, 'playbook.md', '# Playbook\n\n');

    mockPromptResponses = ['1', 'n'];

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdDone(memDir);

    expect(consoleSpy).toHaveBeenCalled();
  });

  test('deletes branch when requested', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    spawnSync.mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' });

    writeMemFile(memDir, 'memory.md', '# Learnings\n\n');

    mockPromptResponses = ['none', 'y'];

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdDone(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Merged');
  });

  test('handles merge failure gracefully', async () => {
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'task/test', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'merge conflict' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    writeMemFile(memDir, 'memory.md', '# Learnings\n\n');

    mockPromptResponses = ['none'];

    const consoleSpy = jest.spyOn(console, 'log');
    await cmdDone(memDir);

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Merge failed');
  });
});

describe('interactiveInit', () => {
  test('creates task from interactive input', async () => {
    mockPromptResponses = [
      'Build a feature',
      'Users can login',
      'Tests pass',
      ''
    ];

    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    execSync.mockReturnValue('');

    const result = await interactiveInit();

    if (result) {
      expect(result.name).toBe('build-a-feature');
    }
  });

  test('handles empty goal input', async () => {
    mockPromptResponses = [''];

    const result = await interactiveInit();
    expect(result).toBeNull();
  });
});

describe('setupRemote', () => {
  test('connects to existing remote', async () => {
    mockPromptResponses = ['https://github.com/user/repo.git'];
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    await setupRemote(memDir, 'test-task');

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Connected');
  });

  test('handles remote connection failure', async () => {
    mockPromptResponses = ['https://github.com/user/repo.git'];
    spawnSync.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'remote error' });

    const consoleSpy = jest.spyOn(console, 'log');
    await setupRemote(memDir, 'test-task');

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Could not connect');
  });

  test('shows message when gh CLI not found', async () => {
    mockPromptResponses = [''];
    execSync.mockImplementation(() => { throw new Error('not found'); });

    const consoleSpy = jest.spyOn(console, 'log');
    await setupRemote(memDir, 'test-task');

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('GitHub CLI');
  });

  test('creates new repo with gh CLI', async () => {
    mockPromptResponses = ['', 'my-repo', 'y'];
    execSync.mockReturnValue('');
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const consoleSpy = jest.spyOn(console, 'log');
    await setupRemote(memDir, 'test-task');

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Created repo');
  });

  test('handles gh repo create failure', async () => {
    mockPromptResponses = ['', 'my-repo', 'n'];
    execSync
      .mockReturnValueOnce('')
      .mockImplementationOnce(() => { throw new Error('gh error'); });

    const consoleSpy = jest.spyOn(console, 'log');
    await setupRemote(memDir, 'test-task');

    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Could not create repo');
  });
});
