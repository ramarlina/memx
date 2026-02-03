#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ==================== CONFIG ====================

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.mem');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// ==================== SKILL ====================

const MEM_SKILL = `---
name: mem
description: Persistent memory for AI agents. Git-backed, branch-per-task, queryable.
---

# mem - Persistent Agent Memory

Use \`mem\` to maintain state, track progress, and accumulate learnings across sessions.

## Architecture

- **Git-backed**: All state is versioned and syncable
- **Branches = Tasks**: Each task/goal is a separate branch
- **Two scopes**: Task-local memory + global playbook
- **Wake system**: Store schedule intent, export to cron

## On Wake (Start of Session)

\`\`\`bash
mem context                 # Load full state: goal, progress, learnings
\`\`\`

## Core Commands

### Lifecycle
\`\`\`bash
mem init <name> "<goal>"    # Start new task (creates branch)
mem status                  # Current state summary  
mem done                    # Complete task, reflect, merge to main
\`\`\`

### Goal & Criteria
\`\`\`bash
mem goal [value]            # Get/set current goal
mem criteria add "..."      # Add success criterion
mem criteria <n>            # Mark criterion #n complete
mem progress                # Show progress % against criteria
mem constraint add "..."    # Add constraint/boundary
mem constraints             # List constraints
\`\`\`

### Progress
\`\`\`bash
mem next [step]             # Get/set next step
mem checkpoint "<msg>"      # Save progress point
mem stuck [reason|clear]    # Mark/clear blocker
\`\`\`

### Learning
\`\`\`bash
mem learn "<insight>"       # Add task learning
mem learn -g "<insight>"    # Add global learning  
mem learnings               # List learnings with IDs
mem playbook                # View global playbook
mem promote <n>             # Promote learning #n to playbook
\`\`\`

### Tasks (Isolation)
\`\`\`bash
mem tasks                   # List all tasks (branches)
mem switch <name>           # Switch to different task
\`\`\`

### Wake & Sync
\`\`\`bash
mem wake "every 15m"        # Set wake schedule
mem wake "8am daily"        # Other patterns: monday 9am, */30 * * * *
mem cron export             # Export as crontab entry
mem sync                    # Push/pull with remote
\`\`\`

## File Structure

\`\`\`
.mem/
  goal.md           # Objective + criteria + constraints
  state.md          # Progress, next step, blockers, wake
  memory.md         # Task-specific learnings
  playbook.md       # Global learnings (shared)
\`\`\`

## Typical Session Loop

1. \`mem context\` - Load state on wake
2. \`mem next\` - See what to work on
3. Do work
4. \`mem checkpoint "..."\` - Save progress
5. \`mem learn "..."\` - Capture insights
6. \`mem next "..."\` - Set next step for future self

## When to use mem

- Tracking long-running goals across sessions
- Accumulating learnings that persist  
- Coordinating between multiple agents
- Maintaining continuity when context resets
`;

// ==================== COLORS ====================

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

// ==================== UTILS ====================

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return { repos: {} };
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Find .mem directory (walk up from cwd)
function findMemDir(startDir = process.cwd()) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const memDir = path.join(dir, '.mem');
    if (fs.existsSync(memDir) && fs.existsSync(path.join(memDir, '.git'))) {
      return memDir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// Run git command in .mem directory
function git(memDir, ...args) {
  try {
    // Use spawn-style args for proper escaping
    const result = require('child_process').spawnSync('git', args, {
      cwd: memDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || 'Git command failed');
    }
    return (result.stdout || '').trim();
  } catch (err) {
    throw err;
  }
}

// Get current branch
function getCurrentBranch(memDir) {
  return git(memDir, 'rev-parse', '--abbrev-ref', 'HEAD');
}

// Read a file from .mem
function readMemFile(memDir, filename) {
  const filepath = path.join(memDir, filename);
  if (fs.existsSync(filepath)) {
    return fs.readFileSync(filepath, 'utf8');
  }
  return null;
}

// Write a file to .mem
function writeMemFile(memDir, filename, content) {
  const filepath = path.join(memDir, filename);
  fs.writeFileSync(filepath, content);
}

// Parse frontmatter from markdown
function parseFrontmatter(content) {
  if (!content) return { frontmatter: {}, body: '' };
  
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (match) {
    const frontmatter = {};
    match[1].split('\n').forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        frontmatter[key.trim()] = rest.join(':').trim();
      }
    });
    return { frontmatter, body: match[2].trim() };
  }
  return { frontmatter: {}, body: content };
}

// Serialize frontmatter + body
function serializeFrontmatter(frontmatter, body) {
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `---\n${fm}\n---\n\n${body}`;
}

// ==================== COMMANDS ====================

// Interactive onboarding
async function interactiveInit() {
  console.log(`\n${c.bold}${c.cyan}mem${c.reset} ${c.dim}— persistent memory for AI agents${c.reset}\n`);
  console.log(`No ${c.cyan}.mem${c.reset} found. Let's set one up!\n`);
  
  // Get goal
  const goalText = await prompt(`${c.bold}What are you working on?${c.reset}\n> `);
  if (!goalText) {
    console.log(`${c.dim}Cancelled${c.reset}`);
    return;
  }
  
  // Generate task name from goal
  const name = goalText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join('-');
  
  console.log(`\n${c.bold}How will you know it's done?${c.reset} ${c.dim}(add criteria, empty line to finish)${c.reset}\n`);
  
  const criteria = [];
  let i = 1;
  while (true) {
    const criterion = await prompt(`${c.dim}${i}.${c.reset} `);
    if (!criterion) break;
    criteria.push(criterion);
    i++;
  }
  
  // Create .mem directory
  const targetDir = path.join(process.cwd(), '.mem');
  fs.mkdirSync(targetDir, { recursive: true });
  
  try {
    require('child_process').execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    
    // Create playbook on main
    writeMemFile(targetDir, 'playbook.md', `# Playbook\n\nGlobal learnings that transfer across tasks.\n`);
    writeMemFile(targetDir, '.gitignore', '');
    
    git(targetDir, 'add', '-A');
    git(targetDir, 'commit', '-m', 'init: memory repo');
    
    // Create task branch
    const branch = `task/${name}`;
    git(targetDir, 'checkout', '-b', branch);
    
    // Build criteria markdown
    const criteriaText = criteria.length 
      ? criteria.map(c => `- [ ] ${c}`).join('\n')
      : '- [ ] Define your first criterion';
    
    writeMemFile(targetDir, 'goal.md', serializeFrontmatter(
      { task: name, created: new Date().toISOString().split('T')[0] },
      `# Goal\n\n${goalText}\n\n## Definition of Done\n\n${criteriaText}\n\n## Progress: 0%`
    ));
    writeMemFile(targetDir, 'state.md', serializeFrontmatter(
      { status: 'active' },
      `# State\n\n## Next Step\n\nDefine approach\n\n## Checkpoints\n\n- [ ] Started`
    ));
    writeMemFile(targetDir, 'memory.md', `# Learnings\n\n`);
    
    git(targetDir, 'add', '-A');
    git(targetDir, 'commit', '-m', `init: ${name}`);
    
    console.log(`\n${c.green}✓${c.reset} Created ${c.cyan}.mem/${c.reset}`);
    console.log(`${c.green}✓${c.reset} Task: ${c.bold}${name}${c.reset}`);
    if (criteria.length) {
      console.log(`${c.green}✓${c.reset} ${criteria.length} success criteria defined`);
    }
    
    // Offer remote sync setup
    const wantRemote = await prompt(`\n${c.bold}Sync to GitHub?${c.reset} ${c.dim}(keeps memory backed up + shareable)${c.reset} [y/N]: `);
    
    if (wantRemote.toLowerCase() === 'y' || wantRemote.toLowerCase() === 'yes') {
      await setupRemote(targetDir, name);
    }
    
    console.log(`\n${c.dim}Run ${c.reset}mem status${c.dim} to see your progress${c.reset}\n`);
    
  } catch (err) {
    console.log(`${c.red}Error:${c.reset} ${err.message}`);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}

// Setup git remote
async function setupRemote(memDir, taskName) {
  // Check if gh CLI is available
  let hasGh = false;
  try {
    require('child_process').execSync('which gh', { stdio: 'ignore' });
    hasGh = true;
  } catch {}
  
  const existingRepo = await prompt(`\n${c.dim}GitHub repo URL (leave empty to create new):${c.reset} `);
  
  if (existingRepo) {
    // Connect to existing repo
    try {
      git(memDir, 'remote', 'add', 'origin', existingRepo);
      git(memDir, 'push', '-u', 'origin', 'main');
      git(memDir, 'push', '-u', 'origin', `task/${taskName}`);
      console.log(`${c.green}✓${c.reset} Connected to ${c.dim}${existingRepo}${c.reset}`);
    } catch (err) {
      console.log(`${c.yellow}Could not connect:${c.reset} ${err.message}`);
      console.log(`${c.dim}You can set it up later with: cd .mem && git remote add origin <url>${c.reset}`);
    }
    return;
  }
  
  if (!hasGh) {
    console.log(`${c.yellow}GitHub CLI (gh) not found.${c.reset}`);
    console.log(`${c.dim}Install it to auto-create repos: brew install gh${c.reset}`);
    console.log(`${c.dim}Or set up manually: cd .mem && git remote add origin <url>${c.reset}`);
    return;
  }
  
  // Create new repo with gh
  const repoName = await prompt(`${c.dim}Repo name${c.reset} [${taskName}-mem]: `) || `${taskName}-mem`;
  const isPrivate = await prompt(`${c.dim}Private repo?${c.reset} [Y/n]: `);
  const visibility = (isPrivate.toLowerCase() === 'n') ? '--public' : '--private';
  
  try {
    const { execSync } = require('child_process');
    execSync(`gh repo create ${repoName} ${visibility} --source=. --push`, {
      cwd: memDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Also push the task branch
    git(memDir, 'push', '-u', 'origin', `task/${taskName}`);
    
    console.log(`${c.green}✓${c.reset} Created repo: ${c.cyan}${repoName}${c.reset}`);
    console.log(`${c.dim}Run ${c.reset}mem sync${c.dim} anytime to push/pull${c.reset}`);
  } catch (err) {
    console.log(`${c.yellow}Could not create repo:${c.reset} ${err.message}`);
    console.log(`${c.dim}You can set it up later manually${c.reset}`);
  }
}

// Initialize a new memory repo
async function cmdInit(args, memDir) {
  const name = args[0];
  const goal = args.slice(1).join(' ');
  
  // Interactive mode if no args and no existing .mem
  if (!name && !memDir) {
    return await interactiveInit();
  }
  
  if (!name) {
    console.log(`${c.red}Usage:${c.reset} mem init <name> "<goal>"`);
    return;
  }

  // If already in a mem repo, create a new task branch
  if (memDir) {
    const branch = `task/${name}`;
    try {
      git(memDir, 'checkout', '-b', branch);
      console.log(`${c.green}✓${c.reset} Created task branch: ${c.cyan}${branch}${c.reset}`);
      
      if (goal) {
        writeMemFile(memDir, 'goal.md', serializeFrontmatter(
          { task: name, created: new Date().toISOString().split('T')[0] },
          `# Goal\n\n${goal}\n\n## Definition of Done\n\n- [ ] Define success criteria\n\n## Progress: 0%`
        ));
        writeMemFile(memDir, 'state.md', serializeFrontmatter(
          { status: 'active' },
          `# State\n\n## Next Step\n\nDefine approach\n\n## Checkpoints\n\n- [ ] Started`
        ));
        writeMemFile(memDir, 'memory.md', `# Learnings\n\n`);
        
        git(memDir, 'add', '-A');
        git(memDir, 'commit', '-m', `init: ${name}`);
        
        console.log(`${c.green}✓${c.reset} Initialized task: ${goal}`);
      }
    } catch (err) {
      console.log(`${c.red}Error:${c.reset} ${err.message}`);
    }
    return;
  }

  // Create new .mem repo
  const targetDir = path.join(process.cwd(), '.mem');
  
  if (fs.existsSync(targetDir)) {
    console.log(`${c.yellow}.mem already exists in this directory${c.reset}`);
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  
  try {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    
    // Create initial files on main
    writeMemFile(targetDir, 'playbook.md', `# Playbook\n\nGlobal learnings that transfer across tasks.\n`);
    writeMemFile(targetDir, '.gitignore', '');
    
    git(targetDir, 'add', '-A');
    git(targetDir, 'commit', '-m', 'init: memory repo');
    
    console.log(`${c.green}✓${c.reset} Created memory repo: ${c.dim}${targetDir}${c.reset}`);
    
    // Create task branch if name provided
    if (name && name !== 'main') {
      const branch = `task/${name}`;
      git(targetDir, 'checkout', '-b', branch);
      
      writeMemFile(targetDir, 'goal.md', serializeFrontmatter(
        { task: name, created: new Date().toISOString().split('T')[0] },
        `# Goal\n\n${goal || 'Define your goal here'}\n\n## Definition of Done\n\n- [ ] Criterion 1\n- [ ] Criterion 2\n- [ ] Criterion 3\n\n## Progress: 0%`
      ));
      writeMemFile(targetDir, 'state.md', serializeFrontmatter(
        { status: 'active' },
        `# State\n\n## Next Step\n\nDefine approach\n\n## Checkpoints\n\n- [ ] Started`
      ));
      writeMemFile(targetDir, 'memory.md', `# Learnings\n\n`);
      
      git(targetDir, 'add', '-A');
      git(targetDir, 'commit', '-m', `init: ${name}`);
      
      console.log(`${c.green}✓${c.reset} Created task: ${c.cyan}${name}${c.reset}`);
      if (goal) {
        console.log(`${c.dim}Goal: ${goal}${c.reset}`);
      }
    }
  } catch (err) {
    console.log(`${c.red}Error:${c.reset} ${err.message}`);
    // Cleanup on failure
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}

// Show current status
function cmdStatus(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset} Run ${c.cyan}mem init${c.reset} first.`);
    return;
  }

  const branch = getCurrentBranch(memDir);
  const goal = readMemFile(memDir, 'goal.md');
  const state = readMemFile(memDir, 'state.md');
  
  console.log(`\n${c.bold}Memory Status${c.reset}\n`);
  console.log(`${c.dim}Branch:${c.reset} ${c.cyan}${branch}${c.reset}`);
  console.log(`${c.dim}Repo:${c.reset} ${memDir}`);
  
  if (goal) {
    const { frontmatter, body } = parseFrontmatter(goal);
    const goalLine = body.split('\n').find(l => l && !l.startsWith('#'));
    if (goalLine) {
      console.log(`\n${c.bold}Goal:${c.reset} ${goalLine}`);
    }
    if (frontmatter.status) {
      console.log(`${c.dim}Status:${c.reset} ${frontmatter.status}`);
    }
  }
  
  if (state) {
    const { body } = parseFrontmatter(state);
    const nextMatch = body.match(/## Next Step\n\n([^\n#]+)/);
    if (nextMatch) {
      console.log(`\n${c.bold}Next:${c.reset} ${nextMatch[1]}`);
    }
    
    // Show recent checkpoints
    const checkpointsMatch = body.match(/## Checkpoints\n\n([\s\S]*?)(?=\n##|$)/);
    if (checkpointsMatch) {
      const checkpoints = checkpointsMatch[1].trim().split('\n').slice(-3);
      if (checkpoints.length) {
        console.log(`\n${c.bold}Recent Checkpoints:${c.reset}`);
        checkpoints.forEach(cp => console.log(`  ${cp}`));
      }
    }
  }
  
  console.log('');
}

// Get/set goal
function cmdGoal(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  if (args.length === 0) {
    // Get goal
    const goal = readMemFile(memDir, 'goal.md');
    if (goal) {
      console.log(goal);
    } else {
      console.log(`${c.dim}No goal set${c.reset}`);
    }
    return;
  }

  // Set goal
  const newGoal = args.join(' ');
  const existing = readMemFile(memDir, 'goal.md');
  const { frontmatter } = parseFrontmatter(existing || '');
  
  writeMemFile(memDir, 'goal.md', serializeFrontmatter(
    { ...frontmatter, updated: new Date().toISOString().split('T')[0] },
    `# Goal\n\n${newGoal}`
  ));
  
  git(memDir, 'add', 'goal.md');
  git(memDir, 'commit', '-m', `goal: ${newGoal.slice(0, 50)}`);
  
  console.log(`${c.green}✓${c.reset} Goal updated`);
}

// Get/set next step
function cmdNext(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const state = readMemFile(memDir, 'state.md') || '';
  const { frontmatter, body } = parseFrontmatter(state);

  if (args.length === 0) {
    // Get next step
    const nextMatch = body.match(/## Next Step\n\n([^\n#]+)/);
    if (nextMatch) {
      console.log(nextMatch[1]);
    } else {
      console.log(`${c.dim}No next step set${c.reset}`);
    }
    return;
  }

  // Set next step
  const nextStep = args.join(' ');
  let newBody = body;
  
  if (body.includes('## Next Step')) {
    newBody = body.replace(/## Next Step\n\n[^\n#]*/, `## Next Step\n\n${nextStep}`);
  } else {
    newBody = `## Next Step\n\n${nextStep}\n\n${body}`;
  }
  
  writeMemFile(memDir, 'state.md', serializeFrontmatter(frontmatter, newBody));
  git(memDir, 'add', 'state.md');
  git(memDir, 'commit', '-m', `next: ${nextStep.slice(0, 50)}`);
  
  console.log(`${c.green}✓${c.reset} Next step: ${nextStep}`);
}

// Add checkpoint
function cmdCheckpoint(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const msg = args.join(' ');
  if (!msg) {
    console.log(`${c.red}Usage:${c.reset} mem checkpoint "<message>"`);
    return;
  }

  const state = readMemFile(memDir, 'state.md') || '';
  const { frontmatter, body } = parseFrontmatter(state);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const checkpoint = `- [x] ${timestamp}: ${msg}`;
  
  let newBody = body;
  if (body.includes('## Checkpoints')) {
    newBody = body.replace(/## Checkpoints\n\n/, `## Checkpoints\n\n${checkpoint}\n`);
  } else {
    newBody = `${body}\n\n## Checkpoints\n\n${checkpoint}`;
  }
  
  writeMemFile(memDir, 'state.md', serializeFrontmatter(frontmatter, newBody));
  git(memDir, 'add', 'state.md');
  git(memDir, 'commit', '-m', `checkpoint: ${msg.slice(0, 50)}`);
  
  console.log(`${c.green}✓${c.reset} Checkpoint: ${msg}`);
}

// Add learning
function cmdLearn(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  // Check for -g flag (global)
  const isGlobal = args[0] === '-g';
  if (isGlobal) args = args.slice(1);
  
  const insight = args.join(' ');
  if (!insight) {
    console.log(`${c.red}Usage:${c.reset} mem learn [-g] "<insight>"`);
    return;
  }

  const filename = isGlobal ? 'playbook.md' : 'memory.md';
  const content = readMemFile(memDir, filename) || `# ${isGlobal ? 'Playbook' : 'Learnings'}\n\n`;
  
  const timestamp = new Date().toISOString().split('T')[0];
  const newContent = content + `- ${timestamp}: ${insight}\n`;
  
  writeMemFile(memDir, filename, newContent);
  git(memDir, 'add', filename);
  git(memDir, 'commit', '-m', `learn: ${insight.slice(0, 50)}`);
  
  console.log(`${c.green}✓${c.reset} ${isGlobal ? 'Global' : 'Task'} learning added`);
}

// Show context (full hydration)
function cmdContext(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const branch = getCurrentBranch(memDir);
  const goal = readMemFile(memDir, 'goal.md');
  const state = readMemFile(memDir, 'state.md');
  const memory = readMemFile(memDir, 'memory.md');
  const playbook = readMemFile(memDir, 'playbook.md');

  console.log(`# Context\n`);
  console.log(`Branch: ${branch}\n`);
  
  if (goal) {
    console.log(`## Goal\n`);
    const { body } = parseFrontmatter(goal);
    const goalLine = body.split('\n').find(l => l && !l.startsWith('#'));
    console.log(goalLine || 'Not set');
    console.log('');
  }
  
  if (state) {
    console.log(`## State\n`);
    const { body } = parseFrontmatter(state);
    console.log(body);
    console.log('');
  }
  
  if (memory && memory.trim() !== '# Learnings\n\n' && memory.trim() !== '# Learnings') {
    console.log(`## Task Learnings\n`);
    const lines = memory.split('\n').filter(l => l.startsWith('- '));
    lines.forEach(l => console.log(l));
    console.log('');
  }
  
  if (playbook && playbook.trim() !== '# Playbook\n\nGlobal learnings that transfer across tasks.\n') {
    console.log(`## Playbook (Global)\n`);
    const lines = playbook.split('\n').filter(l => l.startsWith('- '));
    lines.slice(-10).forEach(l => console.log(l)); // Last 10 global learnings
    console.log('');
  }
}

// List tasks
function cmdTasks(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const current = getCurrentBranch(memDir);
  const branches = git(memDir, 'branch', '--list').split('\n');
  
  console.log(`\n${c.bold}Tasks${c.reset}\n`);
  
  branches.forEach(b => {
    const name = b.replace('*', '').trim();
    const isCurrent = b.includes('*');
    const marker = isCurrent ? `${c.green}→${c.reset}` : ' ';
    const display = name.replace('task/', '');
    console.log(`${marker} ${isCurrent ? c.cyan : c.dim}${display}${c.reset}`);
  });
  
  console.log('');
}

// Switch task
function cmdSwitch(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const name = args[0];
  if (!name) {
    console.log(`${c.red}Usage:${c.reset} mem switch <name>`);
    return;
  }

  const branch = name.startsWith('task/') ? name : `task/${name}`;
  
  try {
    git(memDir, 'checkout', branch);
    console.log(`${c.green}✓${c.reset} Switched to: ${c.cyan}${branch}${c.reset}`);
  } catch (err) {
    // Try without task/ prefix (for main, etc)
    try {
      git(memDir, 'checkout', name);
      console.log(`${c.green}✓${c.reset} Switched to: ${c.cyan}${name}${c.reset}`);
    } catch {
      console.log(`${c.red}Branch not found:${c.reset} ${name}`);
    }
  }
}

// Sync with remote
function cmdSync(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  try {
    // Check if remote exists
    const remotes = git(memDir, 'remote');
    if (!remotes) {
      console.log(`${c.yellow}No remote configured.${c.reset}`);
      console.log(`${c.dim}Add one with: cd ${memDir} && git remote add origin <url>${c.reset}`);
      return;
    }

    console.log(`${c.cyan}Syncing...${c.reset}`);
    
    const branch = getCurrentBranch(memDir);
    
    try {
      git(memDir, 'pull', '--rebase', 'origin', branch);
      console.log(`${c.green}✓${c.reset} Pulled latest`);
    } catch {
      // Branch might not exist on remote yet
    }
    
    git(memDir, 'push', '-u', 'origin', branch);
    console.log(`${c.green}✓${c.reset} Pushed to origin/${branch}`);
    
  } catch (err) {
    console.log(`${c.red}Sync failed:${c.reset} ${err.message}`);
  }
}

// Show history
function cmdHistory(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const log = git(memDir, 'log', '--oneline', '-20');
  console.log(`\n${c.bold}History${c.reset}\n`);
  console.log(log);
  console.log('');
}

// Complete task
async function cmdDone(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const branch = getCurrentBranch(memDir);
  
  if (branch === 'main') {
    console.log(`${c.yellow}Already on main branch.${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}Completing task: ${branch}${c.reset}\n`);
  
  // Prompt for reflection
  console.log(`${c.cyan}Reflection${c.reset} - What learnings should be promoted to the global playbook?\n`);
  
  const memory = readMemFile(memDir, 'memory.md') || '';
  const learnings = memory.split('\n').filter(l => l.startsWith('- '));
  
  if (learnings.length) {
    console.log(`${c.dim}Task learnings:${c.reset}`);
    learnings.forEach((l, i) => console.log(`  ${i + 1}. ${l.slice(2)}`));
    console.log('');
  }
  
  const toPromote = await prompt('Enter numbers to promote (comma-separated) or "none": ');
  
  if (toPromote && toPromote !== 'none') {
    const indices = toPromote.split(',').map(n => parseInt(n.trim()) - 1);
    const playbook = readMemFile(memDir, 'playbook.md') || '# Playbook\n\n';
    
    let additions = '';
    indices.forEach(i => {
      if (learnings[i]) {
        additions += learnings[i] + '\n';
      }
    });
    
    if (additions) {
      writeMemFile(memDir, 'playbook.md', playbook + additions);
      git(memDir, 'add', 'playbook.md');
      git(memDir, 'commit', '-m', 'promote learnings to playbook');
      console.log(`${c.green}✓${c.reset} Promoted learnings to playbook`);
    }
  }

  // Merge to main
  try {
    git(memDir, 'checkout', 'main');
    git(memDir, 'merge', branch, '-m', `done: ${branch}`);
    console.log(`${c.green}✓${c.reset} Merged ${branch} to main`);
    
    // Optionally delete branch
    const deleteBranch = await prompt('Delete the task branch? [y/N]: ');
    if (deleteBranch.toLowerCase() === 'y') {
      git(memDir, 'branch', '-d', branch);
      console.log(`${c.green}✓${c.reset} Deleted branch: ${branch}`);
    }
  } catch (err) {
    console.log(`${c.red}Merge failed:${c.reset} ${err.message}`);
    git(memDir, 'checkout', branch);
  }
  
  console.log('');
}

// Mark stuck
function cmdStuck(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const state = readMemFile(memDir, 'state.md') || '';
  const { frontmatter, body } = parseFrontmatter(state);

  if (args.length === 0) {
    // Show blocker or clear
    if (frontmatter.blocker) {
      console.log(`${c.red}Blocker:${c.reset} ${frontmatter.blocker}`);
    } else {
      console.log(`${c.green}No blockers${c.reset}`);
    }
    return;
  }

  const reason = args.join(' ');
  
  if (reason === 'clear') {
    delete frontmatter.blocker;
    frontmatter.status = 'active';
  } else {
    frontmatter.blocker = reason;
    frontmatter.status = 'blocked';
  }
  
  writeMemFile(memDir, 'state.md', serializeFrontmatter(frontmatter, body));
  git(memDir, 'add', 'state.md');
  git(memDir, 'commit', '-m', reason === 'clear' ? 'unblocked' : `stuck: ${reason.slice(0, 50)}`);
  
  if (reason === 'clear') {
    console.log(`${c.green}✓${c.reset} Blocker cleared`);
  } else {
    console.log(`${c.yellow}⚠${c.reset} Marked as stuck: ${reason}`);
  }
}

// Query (simple grep for now)
function cmdQuery(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const search = args.join(' ');
  if (!search) {
    console.log(`${c.red}Usage:${c.reset} mem query "<search>"`);
    return;
  }

  try {
    const results = execSync(`grep -r -i -n "${search}" --include="*.md"`, {
      cwd: memDir,
      encoding: 'utf8'
    });
    console.log(results);
  } catch {
    console.log(`${c.dim}No matches found${c.reset}`);
  }
}

// Show playbook
function cmdPlaybook(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const playbook = readMemFile(memDir, 'playbook.md');
  if (playbook) {
    console.log(playbook);
  } else {
    console.log(`${c.dim}No playbook yet${c.reset}`);
  }
}

// List learnings with IDs
function cmdLearnings(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const isGlobal = args[0] === '-g';
  const filename = isGlobal ? 'playbook.md' : 'memory.md';
  const content = readMemFile(memDir, filename) || '';
  
  const lines = content.split('\n').filter(l => l.startsWith('- '));
  
  if (lines.length === 0) {
    console.log(`${c.dim}No learnings yet${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}${isGlobal ? 'Playbook' : 'Task Learnings'}${c.reset}\n`);
  
  lines.forEach((line, i) => {
    // Parse: "- YYYY-MM-DD: text" or just "- text"
    const match = line.match(/^- (?:(\d{4}-\d{2}-\d{2}): )?(.+)$/);
    if (match) {
      const date = match[1] ? `${c.dim}${match[1]}${c.reset} ` : '';
      console.log(`  ${c.cyan}${i + 1}.${c.reset} ${date}${match[2]}`);
    }
  });
  
  if (!isGlobal) {
    console.log(`\n${c.dim}Promote with: mem promote <number>${c.reset}`);
  }
  console.log('');
}

// Promote a learning to playbook
function cmdPromote(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const num = parseInt(args[0]);
  if (!num) {
    console.log(`${c.red}Usage:${c.reset} mem promote <number>`);
    console.log(`${c.dim}Run 'mem learnings' to see numbered list${c.reset}`);
    return;
  }

  const memory = readMemFile(memDir, 'memory.md') || '';
  const lines = memory.split('\n').filter(l => l.startsWith('- '));
  
  if (num < 1 || num > lines.length) {
    console.log(`${c.red}Invalid number.${c.reset} You have ${lines.length} learnings.`);
    return;
  }

  const learning = lines[num - 1];
  
  // Add to playbook
  const playbook = readMemFile(memDir, 'playbook.md') || '# Playbook\n\n';
  const newPlaybook = playbook + learning + '\n';
  writeMemFile(memDir, 'playbook.md', newPlaybook);
  
  git(memDir, 'add', 'playbook.md');
  git(memDir, 'commit', '-m', `promote: ${learning.slice(2, 50)}`);
  
  // Extract just the text for display
  const text = learning.match(/^- (?:\d{4}-\d{2}-\d{2}: )?(.+)$/)?.[1] || learning;
  console.log(`${c.green}✓${c.reset} Promoted to playbook: "${text}"`);
}

// Manage constraints
function cmdConstraint(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const action = args[0];
  const text = args.slice(1).join(' ');
  
  let goal = readMemFile(memDir, 'goal.md') || '';
  
  // Ensure Constraints section exists
  if (!goal.includes('## Constraints')) {
    goal = goal.trimEnd() + '\n\n## Constraints\n\n';
  }

  // List constraints
  if (!action || action === 'list') {
    const match = goal.match(/## Constraints\n\n([\s\S]*?)(?=\n## |$)/);
    if (match) {
      const lines = match[1].trim().split('\n').filter(l => l.startsWith('- '));
      if (lines.length) {
        console.log(`\n${c.bold}Constraints${c.reset}\n`);
        lines.forEach((line, i) => {
          console.log(`  ${c.cyan}${i + 1}.${c.reset} ${line.slice(2)}`);
        });
        console.log('');
        return;
      }
    }
    console.log(`${c.dim}No constraints set${c.reset}`);
    console.log(`${c.dim}Add with: mem constraint add "Don't push without review"${c.reset}`);
    return;
  }

  // Add constraint
  if (action === 'add' && text) {
    goal = goal.replace(
      /## Constraints\n\n/,
      `## Constraints\n\n- ${text}\n`
    );
    writeMemFile(memDir, 'goal.md', goal);
    git(memDir, 'add', 'goal.md');
    git(memDir, 'commit', '-m', `constraint: ${text.slice(0, 40)}`);
    console.log(`${c.green}✓${c.reset} Constraint added: ${text}`);
    return;
  }

  // Remove constraint
  if ((action === 'remove' || action === 'rm') && text) {
    const num = parseInt(text);
    const match = goal.match(/## Constraints\n\n([\s\S]*?)(?=\n## |$)/);
    if (match) {
      const lines = match[1].split('\n');
      let constraintIndex = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('- ')) {
          constraintIndex++;
          if (constraintIndex === num) {
            const removed = lines[i].slice(2);
            lines.splice(i, 1);
            goal = goal.replace(match[0], `## Constraints\n\n${lines.join('\n')}`);
            writeMemFile(memDir, 'goal.md', goal);
            git(memDir, 'add', 'goal.md');
            git(memDir, 'commit', '-m', `remove constraint: ${removed.slice(0, 30)}`);
            console.log(`${c.green}✓${c.reset} Removed: ${removed}`);
            return;
          }
        }
      }
    }
    console.log(`${c.red}Constraint #${num} not found${c.reset}`);
    return;
  }

  // Usage
  console.log(`${c.bold}mem constraint${c.reset} - Manage task constraints\n`);
  console.log(`${c.dim}Commands:${c.reset}`);
  console.log(`  ${c.cyan}mem constraint${c.reset}              List constraints`);
  console.log(`  ${c.cyan}mem constraint add "..."${c.reset}    Add constraint`);
  console.log(`  ${c.cyan}mem constraint remove <n>${c.reset}   Remove by number`);
  console.log('');
}

// Show/update progress
function cmdProgress(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const goal = readMemFile(memDir, 'goal.md');
  if (!goal) {
    console.log(`${c.dim}No goal.md found${c.reset}`);
    return;
  }

  // Count checkboxes in Definition of Done section
  const doneSection = goal.match(/## Definition of Done\n\n([\s\S]*?)(?=\n## |$)/);
  
  if (!doneSection) {
    console.log(`${c.yellow}No "Definition of Done" section found in goal.md${c.reset}`);
    console.log(`${c.dim}Add a section like:\n\n## Definition of Done\n\n- [ ] Criterion 1\n- [x] Criterion 2${c.reset}`);
    return;
  }

  const checkboxes = doneSection[1].match(/- \[[ x]\]/g) || [];
  const checked = (doneSection[1].match(/- \[x\]/g) || []).length;
  const total = checkboxes.length;
  
  if (total === 0) {
    console.log(`${c.yellow}No criteria defined yet${c.reset}`);
    return;
  }

  const percent = Math.round((checked / total) * 100);
  
  // Visual progress bar
  const barWidth = 20;
  const filled = Math.round((percent / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  
  console.log(`\n${c.bold}Progress${c.reset}\n`);
  console.log(`${c.cyan}${bar}${c.reset} ${percent}%`);
  console.log(`${c.dim}${checked}/${total} criteria complete${c.reset}\n`);
  
  // Show criteria
  const lines = doneSection[1].trim().split('\n');
  lines.forEach(line => {
    if (line.startsWith('- [x]')) {
      console.log(`${c.green}✓${c.reset} ${line.slice(6)}`);
    } else if (line.startsWith('- [ ]')) {
      console.log(`${c.dim}○${c.reset} ${line.slice(6)}`);
    }
  });
  
  console.log('');
  
  // Update progress in goal.md if it has a Progress line
  if (goal.includes('## Progress:')) {
    const updatedGoal = goal.replace(/## Progress: \d+%/, `## Progress: ${percent}%`);
    if (updatedGoal !== goal) {
      writeMemFile(memDir, 'goal.md', updatedGoal);
      git(memDir, 'add', 'goal.md');
      git(memDir, 'commit', '-m', `progress: ${percent}%`);
    }
  }
}

// Mark a criterion as done
function cmdCriteria(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const action = args[0]; // 'add', 'check', or number
  const text = args.slice(1).join(' ');
  
  let goal = readMemFile(memDir, 'goal.md');
  if (!goal) {
    console.log(`${c.dim}No goal.md found${c.reset}`);
    return;
  }

  if (action === 'add' && text) {
    // Add new criterion
    goal = goal.replace(
      /## Definition of Done\n\n/,
      `## Definition of Done\n\n- [ ] ${text}\n`
    );
    writeMemFile(memDir, 'goal.md', goal);
    git(memDir, 'add', 'goal.md');
    git(memDir, 'commit', '-m', `criteria: add "${text.slice(0, 30)}"`);
    console.log(`${c.green}✓${c.reset} Added criterion: ${text}`);
    return;
  }

  if (action === 'check' || !isNaN(parseInt(action))) {
    // Check off a criterion by number
    const num = action === 'check' ? parseInt(text) : parseInt(action);
    
    const lines = goal.split('\n');
    let criteriaIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('- [ ]')) {
        criteriaIndex++;
        if (criteriaIndex === num) {
          lines[i] = lines[i].replace('- [ ]', '- [x]');
          break;
        }
      }
    }
    
    goal = lines.join('\n');
    writeMemFile(memDir, 'goal.md', goal);
    git(memDir, 'add', 'goal.md');
    git(memDir, 'commit', '-m', `criteria: complete #${num}`);
    console.log(`${c.green}✓${c.reset} Marked criterion #${num} complete`);
    
    // Show updated progress
    cmdProgress([], memDir);
    return;
  }

  // Show usage
  console.log(`${c.bold}mem criteria${c.reset} - Manage success criteria\n`);
  console.log(`${c.dim}Commands:${c.reset}`);
  console.log(`  ${c.cyan}mem criteria add "<text>"${c.reset}  Add new criterion`);
  console.log(`  ${c.cyan}mem criteria check <n>${c.reset}    Mark criterion #n complete`);
  console.log(`  ${c.cyan}mem criteria <n>${c.reset}          Same as check`);
  console.log('');
}

// ==================== PRIMITIVES ====================

function cmdSet(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const key = args[0];
  const value = args.slice(1).join(' ');
  
  if (!key || !value) {
    console.log(`${c.red}Usage:${c.reset} mem set <key> <value>`);
    return;
  }

  // Store in a simple key-value format in state.md frontmatter
  const state = readMemFile(memDir, 'state.md') || '';
  const { frontmatter, body } = parseFrontmatter(state);
  
  frontmatter[key] = value;
  
  writeMemFile(memDir, 'state.md', serializeFrontmatter(frontmatter, body));
  git(memDir, 'add', 'state.md');
  git(memDir, 'commit', '-m', `set: ${key}=${value.slice(0, 30)}`);
  
  console.log(`${c.green}✓${c.reset} ${key} = ${value}`);
}

function cmdGet(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const key = args[0];
  
  if (!key) {
    console.log(`${c.red}Usage:${c.reset} mem get <key>`);
    return;
  }

  const state = readMemFile(memDir, 'state.md') || '';
  const { frontmatter } = parseFrontmatter(state);
  
  if (frontmatter[key] !== undefined) {
    console.log(frontmatter[key]);
  } else {
    console.log(`${c.dim}Not set${c.reset}`);
  }
}

function cmdAppend(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const list = args[0];
  const item = args.slice(1).join(' ');
  
  if (!list || !item) {
    console.log(`${c.red}Usage:${c.reset} mem append <list> <item>`);
    return;
  }

  // Map list names to files
  const fileMap = {
    learnings: 'memory.md',
    playbook: 'playbook.md',
    checkpoints: 'state.md'
  };
  
  const filename = fileMap[list];
  if (!filename) {
    console.log(`${c.red}Unknown list:${c.reset} ${list}`);
    console.log(`${c.dim}Valid lists: learnings, playbook, checkpoints${c.reset}`);
    return;
  }

  const timestamp = new Date().toISOString().split('T')[0];
  
  if (list === 'checkpoints') {
    // Special handling for checkpoints in state.md
    cmdCheckpoint([item], memDir);
  } else {
    const content = readMemFile(memDir, filename) || '';
    const newContent = content + `- ${timestamp}: ${item}\n`;
    writeMemFile(memDir, filename, newContent);
    git(memDir, 'add', filename);
    git(memDir, 'commit', '-m', `append ${list}: ${item.slice(0, 40)}`);
    console.log(`${c.green}✓${c.reset} Appended to ${list}`);
  }
}

function cmdLog(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const log = git(memDir, 'log', '--oneline', '-30');
  console.log(log);
}

// ==================== SKILL ====================

function isSkillInstalled(provider) {
  const skillDir = path.join(
    process.env.HOME || process.env.USERPROFILE,
    provider === 'claude' ? '.claude' : '.gemini',
    'skills',
    'mem'
  );
  return fs.existsSync(path.join(skillDir, 'SKILL.md'));
}

function installSkillTo(provider) {
  const baseDir = path.join(
    process.env.HOME || process.env.USERPROFILE,
    provider === 'claude' ? '.claude' : '.gemini',
    'skills',
    'mem'
  );

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  fs.writeFileSync(path.join(baseDir, 'SKILL.md'), MEM_SKILL);
  return baseDir;
}

function handleSkillCommand(args) {
  const subCmd = args[1];

  if (!subCmd || subCmd === 'view' || subCmd === 'show') {
    console.log(`\n${c.bold}${c.cyan}/mem${c.reset} - ${c.dim}LLM instructions for using mem${c.reset}\n`);

    const claudeInstalled = isSkillInstalled('claude');
    const geminiInstalled = isSkillInstalled('gemini');

    if (claudeInstalled || geminiInstalled) {
      console.log(`${c.green}Installed:${c.reset}`);
      if (claudeInstalled) console.log(`  ${c.dim}~/.claude/skills/mem/SKILL.md${c.reset}`);
      if (geminiInstalled) console.log(`  ${c.dim}~/.gemini/skills/mem/SKILL.md${c.reset}`);
      console.log('');
    }

    console.log(c.dim + '─'.repeat(60) + c.reset);
    console.log(MEM_SKILL);
    console.log(c.dim + '─'.repeat(60) + c.reset);

    if (!claudeInstalled && !geminiInstalled) {
      console.log(`\n${c.dim}Install with: ${c.reset}mem skill install`);
    }
    console.log('');
    return;
  }

  if (subCmd === 'install' || subCmd === 'add') {
    const target = args[2];

    console.log(`\n${c.bold}Install mem skill${c.reset}\n`);

    if (!target || target === 'all') {
      let installed = 0;

      // Always try claude
      try {
        const dest = installSkillTo('claude');
        console.log(`${c.green}✓${c.reset} Installed to ${c.dim}${dest}${c.reset}`);
        installed++;
      } catch {}

      // Always try gemini
      try {
        const dest = installSkillTo('gemini');
        console.log(`${c.green}✓${c.reset} Installed to ${c.dim}${dest}${c.reset}`);
        installed++;
      } catch {}

      if (installed > 0) {
        console.log(`\n${c.dim}LLMs can now use /mem to learn how to use persistent memory.${c.reset}\n`);
      }
    } else if (target === 'claude' || target === 'gemini') {
      const dest = installSkillTo(target);
      console.log(`${c.green}✓${c.reset} Installed to ${c.dim}${dest}${c.reset}`);
      console.log(`\n${c.dim}LLMs can now use /mem to learn how to use persistent memory.${c.reset}\n`);
    } else {
      console.log(`${c.yellow}Unknown target:${c.reset} ${target}`);
      console.log(`${c.dim}Usage: mem skill install [claude|gemini|all]${c.reset}\n`);
    }
    return;
  }

  console.log(`${c.bold}mem skill${c.reset} - Manage the mem skill for LLMs\n`);
  console.log(`${c.dim}Commands:${c.reset}`);
  console.log(`  ${c.cyan}mem skill${c.reset}              View the skill content`);
  console.log(`  ${c.cyan}mem skill install${c.reset}      Install to all providers`);
  console.log(`  ${c.cyan}mem skill install claude${c.reset}  Install to Claude only`);
  console.log('');
}

// ==================== WAKE ====================

// Parse wake pattern to cron expression
function parseWakeToCron(pattern) {
  pattern = pattern.toLowerCase().trim();
  
  // Handle intervals: every Xm, every Xh
  const intervalMatch = pattern.match(/^every\s+(\d+)\s*(m|min|minutes?|h|hr|hours?)$/);
  if (intervalMatch) {
    const num = parseInt(intervalMatch[1]);
    const unit = intervalMatch[2][0];
    if (unit === 'm') {
      return `*/${num} * * * *`;
    } else if (unit === 'h') {
      return `0 */${num} * * *`;
    }
  }
  
  // Handle daily: Xam daily, Xpm daily, every day at X
  const dailyMatch = pattern.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:daily|every\s*day)?$/);
  if (dailyMatch) {
    let hour = parseInt(dailyMatch[1]);
    const min = dailyMatch[2] ? parseInt(dailyMatch[2]) : 0;
    const ampm = dailyMatch[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return `${min} ${hour} * * *`;
  }
  
  // Handle weekly: monday 9am, every tuesday at 3pm
  const weeklyMatch = pattern.match(/^(?:every\s+)?(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (weeklyMatch) {
    const days = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const day = days[weeklyMatch[1]];
    let hour = parseInt(weeklyMatch[2]);
    const min = weeklyMatch[3] ? parseInt(weeklyMatch[3]) : 0;
    const ampm = weeklyMatch[4];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return `${min} ${hour} * * ${day}`;
  }
  
  // Already cron format? Pass through
  if (pattern.match(/^[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+\s+[\d\*\/\-\,]+$/)) {
    return pattern;
  }
  
  return null;
}

// Set/get/clear wake
function cmdWake(args, memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const state = readMemFile(memDir, 'state.md') || '';
  const { frontmatter, body } = parseFrontmatter(state);

  // No args: show current wake
  if (args.length === 0) {
    if (frontmatter.wake) {
      console.log(`${c.bold}Wake:${c.reset} ${frontmatter.wake}`);
      if (frontmatter.wake_command) {
        console.log(`${c.bold}Command:${c.reset} ${frontmatter.wake_command}`);
      }
      const cron = parseWakeToCron(frontmatter.wake);
      if (cron) {
        console.log(`${c.dim}Cron: ${cron}${c.reset}`);
      }
    } else {
      console.log(`${c.dim}No wake set${c.reset}`);
      console.log(`${c.dim}Usage: mem wake "every 15m" [--run "command"]${c.reset}`);
    }
    return;
  }

  // Clear wake
  if (args[0] === 'clear') {
    delete frontmatter.wake;
    delete frontmatter.wake_command;
    writeMemFile(memDir, 'state.md', serializeFrontmatter(frontmatter, body));
    git(memDir, 'add', 'state.md');
    git(memDir, 'commit', '-m', 'wake: clear');
    console.log(`${c.green}✓${c.reset} Wake cleared`);
    return;
  }

  // Set wake
  let pattern = '';
  let command = '';
  
  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run' || args[i] === '-r') {
      command = args.slice(i + 1).join(' ');
      break;
    }
    pattern += (pattern ? ' ' : '') + args[i];
  }

  // Validate pattern
  const cron = parseWakeToCron(pattern);
  if (!cron) {
    console.log(`${c.red}Could not parse wake pattern:${c.reset} ${pattern}`);
    console.log(`\n${c.dim}Examples:${c.reset}`);
    console.log(`  mem wake "every 15m"`);
    console.log(`  mem wake "every 2h"`);
    console.log(`  mem wake "8am daily"`);
    console.log(`  mem wake "monday 9am"`);
    console.log(`  mem wake "*/30 * * * *"  ${c.dim}(raw cron)${c.reset}`);
    return;
  }

  frontmatter.wake = pattern;
  if (command) {
    frontmatter.wake_command = command;
  }

  writeMemFile(memDir, 'state.md', serializeFrontmatter(frontmatter, body));
  git(memDir, 'add', 'state.md');
  git(memDir, 'commit', '-m', `wake: ${pattern}`);

  console.log(`${c.green}✓${c.reset} Wake set: ${c.bold}${pattern}${c.reset}`);
  console.log(`${c.dim}Cron: ${cron}${c.reset}`);
  if (command) {
    console.log(`${c.dim}Command: ${command}${c.reset}`);
  }
  console.log(`\n${c.dim}Export with: ${c.reset}mem cron export`);
}

// Export to cron format
function cmdCronExport(memDir) {
  if (!memDir) {
    console.log(`${c.yellow}No .mem repo found.${c.reset}`);
    return;
  }

  const state = readMemFile(memDir, 'state.md') || '';
  const { frontmatter } = parseFrontmatter(state);

  if (!frontmatter.wake) {
    console.log(`${c.yellow}No wake set.${c.reset} Use ${c.cyan}mem wake "pattern"${c.reset} first.`);
    return;
  }

  const cron = parseWakeToCron(frontmatter.wake);
  if (!cron) {
    console.log(`${c.red}Could not parse wake pattern:${c.reset} ${frontmatter.wake}`);
    return;
  }

  const command = frontmatter.wake_command || `cd ${memDir} && mem context`;
  const entry = `${cron} ${command}`;

  // Just output the cron line (can be piped/appended)
  console.log(entry);
}

// ==================== MCP ====================

function startMCPServer(args) {
  const mcpPath = path.join(__dirname, 'mcp.js');
  
  // Pass through args
  const mcpArgs = args.slice(1);
  
  // Run MCP server
  const { spawn } = require('child_process');
  const child = spawn('node', [mcpPath, ...mcpArgs], {
    stdio: 'inherit'
  });
  
  child.on('error', (err) => {
    console.error(`${c.red}Failed to start MCP server:${c.reset}`, err.message);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function showMCPConfig() {
  const mcpPath = path.join(__dirname, 'mcp.js');
  
  console.log(`\n${c.bold}MCP Server Configuration${c.reset}\n`);
  console.log(`Add to your Claude Desktop config (${c.dim}~/Library/Application Support/Claude/claude_desktop_config.json${c.reset}):\n`);
  
  const config = {
    "mcpServers": {
      "mem": {
        "command": "node",
        "args": [mcpPath]
      }
    }
  };
  
  console.log(JSON.stringify(config, null, 2));
  console.log(`\n${c.dim}Or for a specific project:${c.reset}\n`);
  
  const configWithDir = {
    "mcpServers": {
      "mem": {
        "command": "node",
        "args": [mcpPath, "--dir", "/path/to/your/project"]
      }
    }
  };
  
  console.log(JSON.stringify(configWithDir, null, 2));
  console.log('');
}

// ==================== HELP ====================

function showHelp() {
  console.log(`
${c.bold}mem${c.reset} - Persistent memory for AI agents

${c.bold}USAGE${c.reset}
  mem <command> [args]

${c.bold}LIFECYCLE${c.reset}
  init <name> "<goal>"    Start new task (creates .mem repo or branch)
  status                  Current state summary
  done                    Complete task, reflect, merge learnings

${c.bold}PROGRESS${c.reset}
  goal [value]            Get/set current goal
  next [step]             Get/set next step
  checkpoint "<msg>"      Save progress point
  stuck [reason|clear]    Mark/clear blocker

${c.bold}LEARNING${c.reset}
  learn [-g] "<insight>"  Add learning (-g for global)
  learnings [-g]          List learnings with IDs
  playbook                View global playbook
  promote <n>             Promote learning #n to playbook
  constraint add "..."    Add constraint/boundary
  constraint remove <n>   Remove constraint
  constraints             List constraints

${c.bold}PROGRESS${c.reset}
  progress                Show progress % against Definition of Done
  criteria add "<text>"   Add success criterion
  criteria <n>            Mark criterion #n complete

${c.bold}QUERY${c.reset}
  context                 Full hydration for agent wake
  history                 Task progression
  query "<search>"        Search all memory

${c.bold}TASKS${c.reset}
  tasks                   List all tasks (branches)
  switch <name>           Switch to task
  
${c.bold}SYNC${c.reset}
  sync                    Push/pull with remote

${c.bold}PRIMITIVES${c.reset}
  set <key> <value>       Set a value
  get <key>               Get a value
  append <list> <item>    Append to list
  log                     Raw git log

${c.bold}WAKE${c.reset}
  wake "<pattern>"        Set wake schedule (every 15m, 8am daily, etc.)
  wake --run "<cmd>"      Set wake with custom command
  wake clear              Clear wake schedule
  cron export             Export wake as crontab entry

${c.bold}INTEGRATION${c.reset}
  skill                   View LLM skill
  skill install           Install skill to Claude/Gemini
  mcp                     Start MCP server (stdio)
  mcp config              Show MCP config for Claude Desktop

${c.bold}EXAMPLES${c.reset}
  mem init build-landing "Create landing page for repr.dev"
  mem checkpoint "Hero section complete"
  mem learn "Tailwind is faster than custom CSS"
  mem context             # Get full state for new session
  mem done                # Complete and merge learnings

${c.dim}Docs: https://github.com/ramarlina/memx${c.reset}
`);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const cmdArgs = args.slice(1);
  
  // Find .mem repo
  const memDir = findMemDir();
  
  // No command and no .mem? Start interactive onboarding
  if (!cmd && !memDir) {
    await interactiveInit();
    return;
  }
  
  // No command but has .mem? Show status
  if (!cmd && memDir) {
    cmdStatus(memDir);
    console.log(`${c.dim}Run ${c.reset}mem help${c.dim} for all commands${c.reset}\n`);
    return;
  }
  
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    showHelp();
    return;
  }

  switch (cmd) {
    // Lifecycle
    case 'init':
      await cmdInit(cmdArgs, memDir);
      break;
    case 'status':
      cmdStatus(memDir);
      break;
    case 'done':
      await cmdDone(memDir);
      break;
      
    // Progress
    case 'goal':
      cmdGoal(cmdArgs, memDir);
      break;
    case 'next':
      cmdNext(cmdArgs, memDir);
      break;
    case 'checkpoint':
    case 'cp':
      cmdCheckpoint(cmdArgs, memDir);
      break;
    case 'stuck':
      cmdStuck(cmdArgs, memDir);
      break;
      
    // Learning
    case 'learn':
      cmdLearn(cmdArgs, memDir);
      break;
    case 'learnings':
    case 'ls-learn':
      cmdLearnings(cmdArgs, memDir);
      break;
    case 'playbook':
    case 'pb':
      cmdPlaybook(memDir);
      break;
    case 'promote':
      cmdPromote(cmdArgs, memDir);
      break;
    case 'constraint':
    case 'constraints':
      cmdConstraint(cmdArgs, memDir);
      break;
    
    // Progress
    case 'progress':
    case 'prog':
    case '%':
      cmdProgress(cmdArgs, memDir);
      break;
    case 'criteria':
    case 'crit':
      cmdCriteria(cmdArgs, memDir);
      break;
      
    // Query
    case 'context':
    case 'ctx':
      cmdContext(memDir);
      break;
    case 'history':
    case 'hist':
      cmdHistory(memDir);
      break;
    case 'query':
    case 'q':
      cmdQuery(cmdArgs, memDir);
      break;
      
    // Tasks
    case 'tasks':
    case 'ls':
      cmdTasks(memDir);
      break;
    case 'switch':
    case 'sw':
      cmdSwitch(cmdArgs, memDir);
      break;
      
    // Sync
    case 'sync':
      cmdSync(memDir);
      break;
      
    // Primitives
    case 'set':
      cmdSet(cmdArgs, memDir);
      break;
    case 'get':
      cmdGet(cmdArgs, memDir);
      break;
    case 'append':
      cmdAppend(cmdArgs, memDir);
      break;
    case 'log':
      cmdLog(memDir);
      break;
      
    // Skill
    case 'skill':
      handleSkillCommand(args);
      break;
    
    // Wake
    case 'wake':
      cmdWake(cmdArgs, memDir);
      break;
    case 'cron':
      if (cmdArgs[0] === 'export') {
        cmdCronExport(memDir);
      } else {
        console.log(`${c.dim}Usage: mem cron export${c.reset}`);
      }
      break;
    
    // MCP
    case 'mcp':
      if (cmdArgs[0] === 'config') {
        showMCPConfig();
      } else {
        startMCPServer(args);
      }
      break;
      
    default:
      console.log(`${c.red}Unknown command:${c.reset} ${cmd}`);
      console.log(`${c.dim}Run ${c.reset}mem help${c.dim} for usage${c.reset}`);
  }
}

main().catch(err => {
  console.error(`${c.red}Error:${c.reset}`, err.message);
  process.exit(1);
});
