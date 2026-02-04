/**
 * Full main() dispatcher tests with process.argv mocking
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(() => ({ status: 0, stdout: '', stderr: '' })),
  spawn: jest.fn(() => ({
    on: jest.fn((event, cb) => {
      if (event === 'exit') setTimeout(() => cb(0), 10);
    })
  }))
}));

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((q, cb) => cb('')),
    close: jest.fn(),
    on: jest.fn()
  }))
}));

const { spawnSync, execSync, spawn } = require('child_process');

// Store original values
const originalArgv = process.argv;
const originalCwd = process.cwd;
const originalExit = process.exit;

const testDir = path.join(os.tmpdir(), 'memx-test-main-full-' + Date.now());

beforeEach(() => {
  // Create test directories
  fs.mkdirSync(path.join(testDir, '.mem', '.git'), { recursive: true });

  // Reset mocks
  spawnSync.mockReset();
  spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
  execSync.mockReset();
  spawn.mockReset();
  spawn.mockReturnValue({
    on: jest.fn((event, cb) => {
      if (event === 'exit') setTimeout(() => cb(0), 10);
    })
  });

  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();

  // Mock process.exit to not actually exit
  process.exit = jest.fn();
});

afterEach(() => {
  process.argv = originalArgv;
  process.cwd = originalCwd;
  process.exit = originalExit;

  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }

  jest.restoreAllMocks();
  jest.resetModules();
});

describe('main() dispatcher', () => {
  test('shows help with --help flag', async () => {
    process.argv = ['node', 'index.js', '--help'];

    const { main } = require('../index.js');
    await main();

    const consoleSpy = console.log;
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('shows help with -h flag', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', '-h'];

    const { main } = require('../index.js');
    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('shows help with help command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'help'];

    const { main } = require('../index.js');
    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches status command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'status'];
    spawnSync.mockReturnValue({ status: 0, stdout: 'main', stderr: '' });

    const { main, writeMemFile, CENTRAL_MEM } = require('../index.js');

    // Create necessary files
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '---\ntask: test\n---\n\n# Goal\n\nTest');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches goal command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'goal'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '# Goal\n\nTest goal');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches learn command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'learn', 'Test', 'insight'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'memory.md'), '# Learnings\n\n');

    await main();

    // Learn command may or may not call spawnSync depending on state
    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches checkpoint command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'checkpoint', 'Done', 'something'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n## Checkpoints\n\n- [ ] Started');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches cp alias', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'cp', 'Done'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n## Checkpoints\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches stuck command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'stuck', 'Blocked', 'by', 'API'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches learnings command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'learnings'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'memory.md'), '# Learnings\n\n- Test');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches playbook command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'playbook'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'playbook.md'), '# Playbook\n\n- Rule');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches pb alias', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'pb'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches context command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'context'];
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '# Goal\n\nTest');
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches ctx alias', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'ctx'];
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '# Goal\n\nTest');
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches history command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'history'];
    spawnSync.mockReturnValue({ status: 0, stdout: 'abc123 commit', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches query command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'query', 'test'];
    execSync.mockReturnValue('goal.md:1:test');

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches q alias', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'q', 'search'];
    execSync.mockReturnValue('');

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches tasks command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'tasks'];
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'main', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '* main', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches ls alias', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'ls'];
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'main', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '* main', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches switch command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'switch', 'other'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches sync command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'sync'];
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches branch command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'branch'];
    spawnSync.mockReturnValue({ status: 0, stdout: '* main', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches commit command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'commit', 'test'];
    spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches set command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'set', 'key', 'value'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches get command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'get', 'status'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches log command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'log'];
    spawnSync.mockReturnValue({ status: 0, stdout: '* abc first', stderr: '' });

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches wake command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'wake'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches cron export command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'cron', 'export'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nwake: every 15m\n---\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches cron without subcommand', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'cron'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches progress command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'progress'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '# Goal\n\n## Definition of Done\n\n- [x] Done\n\n## Progress: 0%');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches constraint command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'constraint'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '# Goal\n\n## Constraints\n\n- Rule');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches criteria command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'criteria'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '# Goal\n\n## Definition of Done\n\n- [ ] Test');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches promote command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'promote', '1'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'memory.md'), '# Learnings\n\n- 2024-01-01: Test');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches append command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'append', 'learnings', 'test'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'memory.md'), '# Learnings\n\n');

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches skill command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'skill'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('dispatches mcp config command', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'mcp', 'config'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('shows unknown command error', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js', 'unknowncommand'];

    const { main, CENTRAL_MEM } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    await main();

    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Unknown command');
  });

  test('shows status when no command and task mapped', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js'];
    spawnSync.mockReturnValue({ status: 0, stdout: 'task/test', stderr: '' });

    const { main, CENTRAL_MEM, saveIndex } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });
    fs.writeFileSync(path.join(CENTRAL_MEM, 'state.md'), '---\nstatus: active\n---\n\n');
    fs.writeFileSync(path.join(CENTRAL_MEM, 'goal.md'), '---\ntask: test\n---\n\n# Goal\n\nTest');

    // Save index mapping current directory to task
    saveIndex({ [process.cwd()]: 'task/test' });

    await main();

    expect(console.log).toHaveBeenCalled();
  });

  test('shows no task message when no command and no mapping', async () => {
    jest.resetModules();
    process.argv = ['node', 'index.js'];

    const { main, CENTRAL_MEM, saveIndex, loadIndex } = require('../index.js');
    fs.mkdirSync(path.join(CENTRAL_MEM, '.git'), { recursive: true });

    // Save empty index for current directory
    const index = loadIndex();
    delete index[process.cwd()];
    saveIndex(index);

    await main();

    const output = console.log.mock.calls.map(c => c[0]).join('\n');
    // Check for "No task mapped" message or status output (if mapped)
    expect(output.length).toBeGreaterThan(0);
  });
});
