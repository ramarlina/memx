#!/usr/bin/env node

/**
 * MCP Server for mem - exposes memory operations as tools
 * 
 * Usage: mem mcp [--dir <path>]
 * 
 * Tools exposed:
 * - mem_context: Get full context (goal, state, learnings)
 * - mem_checkpoint: Save a progress checkpoint
 * - mem_learn: Add a learning
 * - mem_next: Set next step
 * - mem_status: Get current status
 * - mem_stuck: Mark/clear blocker
 */

const { spawnSync } = require('child_process');
const readline = require('readline');

// Run mem command and return output
function runMem(args, cwd) {
  const result = spawnSync('mem', args, {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return {
    success: result.status === 0,
    output: result.stdout?.trim() || '',
    error: result.stderr?.trim() || ''
  };
}

// MCP Protocol handler
class MCPServer {
  constructor(workDir) {
    this.workDir = workDir || process.cwd();
  }

  // List available tools
  listTools() {
    return {
      tools: [
        {
          name: 'mem_context',
          description: 'Get full memory context - goal, state, learnings, playbook. Use on wake to hydrate.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'mem_status',
          description: 'Get current task status summary',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'mem_checkpoint',
          description: 'Save a progress checkpoint',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Checkpoint message describing what was accomplished'
              }
            },
            required: ['message']
          }
        },
        {
          name: 'mem_learn',
          description: 'Add a learning or insight',
          inputSchema: {
            type: 'object',
            properties: {
              insight: {
                type: 'string',
                description: 'The learning or insight to record'
              },
              global: {
                type: 'boolean',
                description: 'If true, add to global playbook instead of task memory'
              }
            },
            required: ['insight']
          }
        },
        {
          name: 'mem_next',
          description: 'Set the next step to work on',
          inputSchema: {
            type: 'object',
            properties: {
              step: {
                type: 'string',
                description: 'Description of the next step'
              }
            },
            required: ['step']
          }
        },
        {
          name: 'mem_stuck',
          description: 'Mark task as stuck with a blocker, or clear blockers',
          inputSchema: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Reason for being stuck, or "clear" to remove blocker'
              }
            },
            required: ['reason']
          }
        },
        {
          name: 'mem_goal',
          description: 'Get or set the current goal',
          inputSchema: {
            type: 'object',
            properties: {
              goal: {
                type: 'string',
                description: 'New goal to set (omit to just get current goal)'
              }
            },
            required: []
          }
        },
        {
          name: 'mem_tasks',
          description: 'List all tasks (branches)',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'mem_switch',
          description: 'Switch to a different task',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Task name to switch to'
              }
            },
            required: ['task']
          }
        }
      ]
    };
  }

  // Execute a tool
  callTool(name, args) {
    switch (name) {
      case 'mem_context':
        return runMem(['context'], this.workDir);
      
      case 'mem_status':
        return runMem(['status'], this.workDir);
      
      case 'mem_checkpoint':
        return runMem(['checkpoint', args.message], this.workDir);
      
      case 'mem_learn':
        const learnArgs = args.global ? ['learn', '-g', args.insight] : ['learn', args.insight];
        return runMem(learnArgs, this.workDir);
      
      case 'mem_next':
        return runMem(['next', args.step], this.workDir);
      
      case 'mem_stuck':
        return runMem(['stuck', args.reason], this.workDir);
      
      case 'mem_goal':
        return args.goal 
          ? runMem(['goal', args.goal], this.workDir)
          : runMem(['goal'], this.workDir);
      
      case 'mem_tasks':
        return runMem(['tasks'], this.workDir);
      
      case 'mem_switch':
        return runMem(['switch', args.task], this.workDir);
      
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  // Handle incoming JSON-RPC message
  handleMessage(message) {
    const { id, method, params } = message;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'mem',
              version: '0.1.0'
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: this.listTools()
        };

      case 'tools/call':
        const { name, arguments: toolArgs } = params;
        const result = this.callTool(name, toolArgs || {});
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: result.success ? result.output : `Error: ${result.error}`
              }
            ],
            isError: !result.success
          }
        };

      case 'notifications/initialized':
        // Client ready, no response needed
        return null;

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  }

  // Start the server (stdio transport)
  start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        const response = this.handleMessage(message);
        if (response) {
          console.log(JSON.stringify(response));
        }
      } catch (err) {
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error'
          }
        }));
      }
    });

    rl.on('close', () => {
      process.exit(0);
    });
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let workDir = process.cwd();
  
  // Parse --dir argument
  const dirIndex = args.indexOf('--dir');
  if (dirIndex !== -1 && args[dirIndex + 1]) {
    workDir = args[dirIndex + 1];
  }

  const server = new MCPServer(workDir);
  server.start();
}

module.exports = { MCPServer };
