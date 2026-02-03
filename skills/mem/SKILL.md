# mem - Persistent Agent Memory

Use `mem` to maintain state, track progress, and accumulate learnings across sessions. Git-backed, branch-per-task architecture.

## When to Use

- **Long-running tasks** that span multiple sessions
- **Tracking progress** with explicit checkpoints
- **Accumulating learnings** that persist beyond context window
- **Coordinating work** across wake/sleep cycles

## Architecture

```
~/.mem/
  goal.md       # Objective + success criteria
  state.md      # Progress, next step, blockers, wake schedule
  memory.md     # Task-specific learnings
  playbook.md   # Global learnings (shared across tasks)
```

Each task is a git branch. Learnings stay isolated until promoted to playbook.

## Core Commands

### On Wake (Start of Session)
```bash
mem context    # Load full state: goal + progress + learnings
mem status     # Quick summary
mem next       # See what to work on
```

### During Work
```bash
mem checkpoint "<msg>"    # Save progress point
mem learn "<insight>"     # Record learning (-g for global)
mem next "<step>"         # Set next step
mem stuck "<reason>"      # Mark blocker (use "clear" to remove)
```

### Task Lifecycle
```bash
mem init <name> "<goal>"  # Start new task (creates branch)
mem criteria add "..."    # Add success criterion
mem criteria <n>          # Mark criterion #n complete
mem progress              # Show % complete
mem done                  # Complete task, merge learnings
```

### Wake System
```bash
mem wake "every 15m"              # Set wake schedule
mem wake "every 15m" --run "cmd"  # Set schedule + command
mem cron export                   # Output crontab entry
mem wake clear                    # Clear schedule
```

## Typical Session Loop

1. `mem context` — Load state on wake
2. `mem next` — See what to work on
3. Do work
4. `mem checkpoint "..."` — Save progress
5. `mem learn "..."` — Capture insights
6. `mem next "..."` — Set next step for future self

## Output Markers (for automated parsing)

When working in an agx-managed loop, use these markers in your output:

```
[checkpoint: message]   # Parsed → mem checkpoint
[learn: insight]        # Parsed → mem learn
[next: step]            # Parsed → mem next
[criteria: N]           # Parsed → mem criteria N
[done]                  # Task complete, clear wake
[blocked: reason]       # Stop, notify human
[pause]                 # Stop, resume on next wake
```

## MCP Integration

mem provides an MCP server for direct tool access:

```bash
mem mcp        # Start MCP server (stdio)
mem mcp config # Show Claude Desktop config
```
