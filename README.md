# mem

Persistent memory for AI agents. Git-backed, branch-per-task, CLI interface.

```bash
npm install -g @mndrk/memx
```

## Quick Start

```bash
# Run mem in any directory - interactive setup
mem

# Or explicit init
mem init landing "Build landing page for my project"

# Track progress
mem checkpoint "Hero section complete"
mem next "Add testimonials"
mem stuck "Waiting on copy from client"

# Record learnings
mem learn "Tailwind is faster than custom CSS"

# Get full context (on wake)
mem context

# See progress against success criteria
mem progress
```

## Architecture

```
WAKE → LOAD STATE → THINK → ACT → SAVE STATE → SLEEP
```

- **Git-backed**: All state versioned and syncable
- **Branches = Tasks**: Each goal is a separate branch
- **Two scopes**: Task-local memory + global playbook
- **Adapters**: Export wake schedule to cron, pm2, etc.

## File Structure

```
.mem/
  goal.md           # Objective + success criteria + constraints
  state.md          # Progress, next step, blockers, wake schedule
  memory.md         # Task-specific learnings
  playbook.md       # Global learnings (shared across tasks)
```

## Commands

### Lifecycle
```bash
mem init <name> "<goal>"    # Start new task (interactive if no args)
mem status                  # Current state summary
mem done                    # Complete task, reflect, merge learnings
```

### Goal & Criteria
```bash
mem goal [value]            # Get/set goal
mem criteria add "..."      # Add success criterion
mem criteria <n>            # Mark criterion #n complete
mem progress                # Show progress % with visual bar
mem constraint add "..."    # Add constraint/boundary
mem constraints             # List constraints
```

### Progress
```bash
mem next [step]             # Get/set next step
mem checkpoint "<msg>"      # Save progress point
mem stuck [reason|clear]    # Mark/clear blocker
```

### Learning
```bash
mem learn "<insight>"       # Add task learning
mem learn -g "<insight>"    # Add global learning
mem learnings               # List learnings with IDs
mem playbook                # View global playbook
mem promote <n>             # Promote learning #n to playbook
```

### Query
```bash
mem context                 # Full hydration for agent wake
mem history                 # Task progression (git log)
mem query "<search>"        # Search all memory
```

### Tasks (Isolation)
```bash
mem tasks                   # List all tasks (branches)
mem switch <name>           # Switch to different task
```

### Wake & Sync
```bash
mem wake "<pattern>"        # Set wake schedule
mem wake "every 15m"        # Examples: every 15m, 8am daily, monday 9am
mem wake --run "<cmd>"      # Custom wake command
mem wake clear              # Clear wake schedule
mem cron export             # Export as crontab entry
mem sync                    # Push/pull with remote
```

### Integration
```bash
mem skill                   # View LLM skill
mem skill install           # Install skill to Claude/Gemini
mem mcp                     # Start MCP server (stdio)
mem mcp config              # Show config for Claude Desktop
```

## Task Isolation

Each task is a git branch. Switch instantly between contexts:

```bash
mem init landing "Build landing page"   # → task/landing branch
mem init auth "Fix auth bug"            # → task/auth branch

mem switch landing   # Work on landing
mem switch auth      # Context switch to auth

mem done             # Complete, merge learnings to main
```

Learnings stay isolated until promoted to the global playbook.

## Wake System

Store wake intent in memory, export to any scheduler:

```bash
# Set wake schedule
mem wake "every 15m"
mem wake "8am daily" --run "mem context | claude -p 'continue'"

# Export to cron
mem cron export >> /etc/crontab

# Or view for manual setup
mem cron export
# → */15 * * * * cd /path && mem context
```

## For AI Agents

### Claude Code Plugin

Install as a Claude Code plugin for automatic skill loading and slash commands:

```bash
claude plugin install github:ramarlina/memx
```

This adds:
- **Skill**: Claude learns how to use mem automatically
- **MCP Server**: Direct tool access
- **Commands**: `/mem:status`, `/mem:checkpoint`, `/mem:context`

### Manual Setup

Install the skill so LLMs know how to use mem:

```bash
mem skill install
```

Or use MCP for direct integration:

```bash
mem mcp config   # Get config for Claude Desktop
```

## How It Works

1. **Init**: Create `.mem/` with goal + criteria
2. **Wake**: Agent runs `mem context` to hydrate
3. **Work**: Execute, checkpoint, learn
4. **Sleep**: State persisted in git
5. **Repeat**: Next session picks up where left off

The framework enforces:
- Define done before starting (criteria in goal.md)
- Track progress explicitly (checkpoints)
- Capture learnings (memory.md)
- Curate transferable knowledge (promote to playbook)

## License

MIT
