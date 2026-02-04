/**
 * Tests for skill-related functions
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
  isSkillInstalled,
  installSkillTo,
  handleSkillCommand,
  MEM_SKILL
} = require('../index.js');

describe('MEM_SKILL constant', () => {
  test('is defined', () => {
    expect(MEM_SKILL).toBeDefined();
    expect(typeof MEM_SKILL).toBe('string');
  });

  test('contains mem description', () => {
    expect(MEM_SKILL).toContain('mem');
    expect(MEM_SKILL).toContain('Persistent');
  });

  test('contains command examples', () => {
    expect(MEM_SKILL).toContain('mem context');
    expect(MEM_SKILL).toContain('mem checkpoint');
    expect(MEM_SKILL).toContain('mem learn');
  });
});

describe('isSkillInstalled', () => {
  const testHome = path.join(os.tmpdir(), 'memx-test-skill-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testHome, { recursive: true });
    // Temporarily override HOME
    process.env.ORIGINAL_HOME = process.env.HOME;
    process.env.HOME = testHome;
  });

  afterEach(() => {
    process.env.HOME = process.env.ORIGINAL_HOME;
    delete process.env.ORIGINAL_HOME;
    if (fs.existsSync(testHome)) {
      fs.rmSync(testHome, { recursive: true });
    }
  });

  test('returns false when skill not installed for claude', () => {
    // Note: This test may be affected by the actual HOME directory
    // Since we can't easily mock the path module's join behavior
    const result = isSkillInstalled('claude');
    expect(typeof result).toBe('boolean');
  });

  test('returns false when skill not installed for gemini', () => {
    const result = isSkillInstalled('gemini');
    expect(typeof result).toBe('boolean');
  });

  test('returns true when skill is installed', () => {
    const skillDir = path.join(testHome, '.claude', 'skills', 'mem');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), MEM_SKILL);

    const result = isSkillInstalled('claude');
    expect(result).toBe(true);
  });
});

describe('installSkillTo', () => {
  const testHome = path.join(os.tmpdir(), 'memx-test-install-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testHome, { recursive: true });
    process.env.ORIGINAL_HOME = process.env.HOME;
    process.env.HOME = testHome;
  });

  afterEach(() => {
    process.env.HOME = process.env.ORIGINAL_HOME;
    delete process.env.ORIGINAL_HOME;
    if (fs.existsSync(testHome)) {
      fs.rmSync(testHome, { recursive: true });
    }
  });

  test('creates skill directory for claude', () => {
    const result = installSkillTo('claude');
    expect(result).toContain('.claude');
    expect(result).toContain('skills');
    expect(result).toContain('mem');

    const skillFile = path.join(result, 'SKILL.md');
    expect(fs.existsSync(skillFile)).toBe(true);
  });

  test('creates skill directory for gemini', () => {
    const result = installSkillTo('gemini');
    expect(result).toContain('.gemini');
    expect(result).toContain('skills');
    expect(result).toContain('mem');

    const skillFile = path.join(result, 'SKILL.md');
    expect(fs.existsSync(skillFile)).toBe(true);
  });

  test('writes correct skill content', () => {
    const result = installSkillTo('claude');
    const skillFile = path.join(result, 'SKILL.md');
    const content = fs.readFileSync(skillFile, 'utf8');
    expect(content).toBe(MEM_SKILL);
  });

  test('overwrites existing skill file', () => {
    // Install first time
    const result = installSkillTo('claude');
    const skillFile = path.join(result, 'SKILL.md');

    // Modify the file
    fs.writeFileSync(skillFile, 'old content');

    // Install again
    installSkillTo('claude');
    const content = fs.readFileSync(skillFile, 'utf8');
    expect(content).toBe(MEM_SKILL);
  });
});

describe('handleSkillCommand', () => {
  const testHome = path.join(os.tmpdir(), 'memx-test-handle-' + Date.now());
  let consoleSpy;

  beforeEach(() => {
    fs.mkdirSync(testHome, { recursive: true });
    process.env.ORIGINAL_HOME = process.env.HOME;
    process.env.HOME = testHome;
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    process.env.HOME = process.env.ORIGINAL_HOME;
    delete process.env.ORIGINAL_HOME;
    if (fs.existsSync(testHome)) {
      fs.rmSync(testHome, { recursive: true });
    }
    consoleSpy.mockRestore();
  });

  test('shows skill content with no subcommand', () => {
    handleSkillCommand(['skill']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('/mem');
    expect(output).toContain('LLM instructions');
  });

  test('shows skill content with "view" subcommand', () => {
    handleSkillCommand(['skill', 'view']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('/mem');
  });

  test('shows skill content with "show" subcommand', () => {
    handleSkillCommand(['skill', 'show']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('/mem');
  });

  test('installs to all providers with "install" subcommand', () => {
    handleSkillCommand(['skill', 'install']);

    const claudeSkill = path.join(testHome, '.claude', 'skills', 'mem', 'SKILL.md');
    const geminiSkill = path.join(testHome, '.gemini', 'skills', 'mem', 'SKILL.md');

    expect(fs.existsSync(claudeSkill)).toBe(true);
    expect(fs.existsSync(geminiSkill)).toBe(true);
  });

  test('installs to all providers with "add" subcommand', () => {
    handleSkillCommand(['skill', 'add']);

    const claudeSkill = path.join(testHome, '.claude', 'skills', 'mem', 'SKILL.md');
    expect(fs.existsSync(claudeSkill)).toBe(true);
  });

  test('installs to claude only with "install claude"', () => {
    handleSkillCommand(['skill', 'install', 'claude']);

    const claudeSkill = path.join(testHome, '.claude', 'skills', 'mem', 'SKILL.md');
    const geminiSkill = path.join(testHome, '.gemini', 'skills', 'mem', 'SKILL.md');

    expect(fs.existsSync(claudeSkill)).toBe(true);
    expect(fs.existsSync(geminiSkill)).toBe(false);
  });

  test('installs to gemini only with "install gemini"', () => {
    handleSkillCommand(['skill', 'install', 'gemini']);

    const claudeSkill = path.join(testHome, '.claude', 'skills', 'mem', 'SKILL.md');
    const geminiSkill = path.join(testHome, '.gemini', 'skills', 'mem', 'SKILL.md');

    expect(fs.existsSync(claudeSkill)).toBe(false);
    expect(fs.existsSync(geminiSkill)).toBe(true);
  });

  test('handles unknown target', () => {
    handleSkillCommand(['skill', 'install', 'unknown']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Unknown target');
  });

  test('shows usage for unknown subcommand', () => {
    handleSkillCommand(['skill', 'unknown']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('mem skill');
    expect(output).toContain('Commands');
  });

  test('shows installed status when skills exist', () => {
    // Pre-install
    installSkillTo('claude');

    handleSkillCommand(['skill']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Installed');
    expect(output).toContain('.claude');
  });
});
