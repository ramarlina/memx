# mem

Persistent memory for AI agents. Git-backed, branch-per-task, queryable.

## Install

```bash
npm install -g @mnrdk/memx
```

## Quick Start

```bash
# Initialize memory with a goal
mem init landing-page "Build landing page for my project"

# Track progress
mem checkpoint "Hero section complete"
mem next "Add testimonials section"

# Record learnings
mem learn "Tailwind is faster than custom CSS for landing pages"

# Get full context (on wake)
mem context

# Complete and promote learnings
mem done
```

## Architecture

- **Git-backed**: All state versioned and syncable
- **Branches = Tasks**: Each goal is a separate branch  
- **Two scopes**: Task-local memory + global playbook
- **CLI interface**: Predictable commands for humans and agents

## Commands

### Lifecycle
```bash
mem init <name> "<goal>"    # Start new task
mem status                  # Current state  
mem done                    # Complete, reflect, merge
```

### Progress
```bash
mem goal [value]            # Get/set goal
mem next [step]             # Get/set next step
mem checkpoint "<msg>"      # Save progress
mem stuck [reason|clear]    # Mark/clear blocker
```

### Learning
```bash
mem learn "<insight>"       # Add task learning
mem learn -g "<insight>"    # Add global learning
mem playbook                # View global playbook
```

### Query
```bash
mem context                 # Full hydration
mem history                 # Task progression
mem query "<search>"        # Search memory
```

### Tasks
```bash
mem tasks                   # List all tasks
mem switch <name>           # Switch task
```

### Sync
```bash
mem sync                    # Push/pull with remote
```

### Primitives
```bash
mem set <key> <value>       # Set value
mem get <key>               # Get value
mem append <list> <item>    # Append to list
mem log                     # Raw git log
```

## File Structure

```
.mem/
  goal.md           # Current task goal
  state.md          # Progress, next steps, blockers
  memory.md         # Task-specific learnings
  playbook.md       # Global learnings (all branches)
```

## For AI Agents

Install the skill so LLMs know how to use mem:

```bash
mem skill install
```

This installs to `~/.claude/skills/mem/` and `~/.gemini/skills/mem/`.

## How It Works

1. **Wake**: Agent runs `mem context` to hydrate state
2. **Work**: Execute, checkpoint progress, record learnings
3. **Sleep**: State persisted in git
4. **Repeat**: Next session picks up where it left off

Branches enable parallel tasks. Merging promotes learnings to the global playbook.

## License

MIT
