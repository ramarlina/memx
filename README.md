# mem

Persistent memory for AI agents. Git-backed, branch-per-task, CLI interface.

```bash
npm install -g @mndrk/memx
```

## Quick Start

```bash
# Run mem in any directory - interactive setup
mem

# Or create a task
mem new landing "Build landing page for my project"

# Track progress
mem checkpoint "Hero section complete"
mem next "Add testimonials"

# Record learnings
mem learn "Tailwind is faster than custom CSS"

# Get full context
mem context
```

## Architecture

- **Git-backed**: All state versioned and syncable
- **Central repo**: `~/.mem` with index mapping projects to tasks
- **Branches = Tasks**: Each goal is a separate branch
- **Two scopes**: Task-local memory + global playbook
- **KV primitives**: Generic set/get/pop for app-specific data

## File Structure

```
~/.mem/                     # Central memory repo
  index.json                # Maps project dirs to task branches
  playbook.md               # Global learnings (shared)

  # Per-task (on task branch):
  goal.md                   # Objective + criteria
  state.md                  # Status, next step, wake, KV data
  memory.md                 # Task-specific learnings
```

## Commands

### Lifecycle
```bash
mem new <name> "<goal>"     # Create task in central ~/.mem with index
mem init <name> "<goal>"    # Start new task (creates branch)
mem status                  # Current state summary
mem done                    # Complete task, merge learnings
mem delete <name>           # Delete task and remove from index
```

### Context
```bash
mem context                 # Full state: goal, progress, criteria, learnings
mem context --json          # JSON output for programmatic use
mem context <task>          # View specific task without switching
```

### Goal & Criteria
```bash
mem goal [value]            # Get/set goal
mem criteria add "..."      # Add success criterion
mem criteria <n>            # Mark criterion #n complete
mem progress                # Show progress % with visual bar
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

### Tasks
```bash
mem tasks                   # Interactive task browser (TUI)
mem tasks --json            # JSON: all tasks with status, progress, criteria
mem switch <name>           # Switch to different task
mem delete <name>           # Delete task
```

### KV Primitives
```bash
mem set <key> <value>       # Store value in state.md frontmatter
mem get <key>               # Retrieve value
mem pop <key>               # Get value and delete (for queues)
mem pop <key> --json        # JSON output: { "value": "..." }
```

### Wake & Sync
```bash
mem wake "<pattern>"        # Set wake schedule (every 15m, 8am daily)
mem wake clear              # Clear wake schedule
mem cron export             # Export as crontab entry
mem sync                    # Push/pull with remote
```

## Task Isolation

Each task is a git branch. Switch instantly between contexts:

```bash
mem new landing "Build landing page"   # → task/landing branch
mem new auth "Fix auth bug"            # → task/auth branch

mem switch landing   # Work on landing
mem switch auth      # Context switch to auth

mem done             # Complete, merge learnings to main
```

## JSON Output

For programmatic use by agents/tools:

```bash
mem context --json
```

Returns:
```json
{
  "task": "my-task",
  "branch": "task/my-task",
  "status": "active",
  "goal": "Build feature X",
  "progress": 60,
  "criteria": [
    { "index": 1, "done": true, "text": "Design API" },
    { "index": 2, "done": false, "text": "Implement endpoints" }
  ],
  "nextStep": "Add authentication",
  "checkpoints": ["Completed schema design"],
  "learnings": ["Use JWT for auth"],
  "playbook": ["Always define done first"]
}
```

```bash
mem tasks --json
```

Returns all tasks with their full state.

## KV Primitives

Generic key-value storage for app-specific data:

```bash
# Store data
mem set mykey "some value"

# Retrieve
mem get mykey
# → some value

# Get and delete (useful for queues)
mem pop mykey
# → some value (now deleted)

# JSON output for programmatic use
mem pop mykey --json
# → {"value": "some value"}
```

Used by `agx` for nudges:
```bash
# agx stores nudges as JSON array
mem set nudges '["msg1", "msg2"]'
mem pop nudges --json  # Read and clear
```

## For AI Agents

### With agx

`agx` uses mem for all state management:

```bash
agx -a -p "Build todo app"   # Creates task via mem new
agx tasks                    # Lists via mem tasks --json
agx nudge task "hint"        # Stores via mem set/get/pop
```

### Direct Integration

Install skill for Claude/Gemini:

```bash
mem skill install
```

Or use MCP server:

```bash
mem mcp config   # Get config for Claude Desktop
```

## License

MIT
