/**
 * Tests for MCP server (mcp.js)
 */

// Mock child_process before requiring module
jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => ({
    status: 0,
    stdout: 'test output',
    stderr: ''
  }))
}));

const { MCPServer } = require('../mcp.js');
const { spawnSync } = require('child_process');

describe('MCPServer', () => {
  let server;

  beforeEach(() => {
    server = new MCPServer('/test/dir');
    spawnSync.mockClear();
  });

  describe('constructor', () => {
    test('sets workDir from argument', () => {
      const s = new MCPServer('/custom/path');
      expect(s.workDir).toBe('/custom/path');
    });

    test('defaults to cwd if no argument', () => {
      const s = new MCPServer();
      expect(s.workDir).toBe(process.cwd());
    });
  });

  describe('listTools', () => {
    test('returns list of tools', () => {
      const result = server.listTools();
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
    });

    test('includes mem_context tool', () => {
      const result = server.listTools();
      const contextTool = result.tools.find(t => t.name === 'mem_context');
      expect(contextTool).toBeDefined();
      expect(contextTool.description).toContain('context');
    });

    test('includes mem_status tool', () => {
      const result = server.listTools();
      const statusTool = result.tools.find(t => t.name === 'mem_status');
      expect(statusTool).toBeDefined();
    });

    test('includes mem_checkpoint tool', () => {
      const result = server.listTools();
      const checkpointTool = result.tools.find(t => t.name === 'mem_checkpoint');
      expect(checkpointTool).toBeDefined();
      expect(checkpointTool.inputSchema.required).toContain('message');
    });

    test('includes mem_learn tool', () => {
      const result = server.listTools();
      const learnTool = result.tools.find(t => t.name === 'mem_learn');
      expect(learnTool).toBeDefined();
      expect(learnTool.inputSchema.properties).toHaveProperty('insight');
      expect(learnTool.inputSchema.properties).toHaveProperty('global');
    });

    test('includes mem_next tool', () => {
      const result = server.listTools();
      const nextTool = result.tools.find(t => t.name === 'mem_next');
      expect(nextTool).toBeDefined();
      expect(nextTool.inputSchema.required).toContain('step');
    });

    test('includes mem_stuck tool', () => {
      const result = server.listTools();
      const stuckTool = result.tools.find(t => t.name === 'mem_stuck');
      expect(stuckTool).toBeDefined();
    });

    test('includes mem_goal tool', () => {
      const result = server.listTools();
      const goalTool = result.tools.find(t => t.name === 'mem_goal');
      expect(goalTool).toBeDefined();
    });

    test('includes mem_tasks tool', () => {
      const result = server.listTools();
      const tasksTool = result.tools.find(t => t.name === 'mem_tasks');
      expect(tasksTool).toBeDefined();
    });

    test('includes mem_switch tool', () => {
      const result = server.listTools();
      const switchTool = result.tools.find(t => t.name === 'mem_switch');
      expect(switchTool).toBeDefined();
      expect(switchTool.inputSchema.required).toContain('task');
    });
  });

  describe('callTool', () => {
    test('calls mem_context', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'context output', stderr: '' });
      const result = server.callTool('mem_context', {});
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['context'],
        expect.objectContaining({ cwd: '/test/dir' })
      );
      expect(result.success).toBe(true);
      expect(result.output).toBe('context output');
    });

    test('calls mem_status', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'status output', stderr: '' });
      const result = server.callTool('mem_status', {});
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['status'],
        expect.objectContaining({ cwd: '/test/dir' })
      );
    });

    test('calls mem_checkpoint with message', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      const result = server.callTool('mem_checkpoint', { message: 'Test checkpoint' });
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['checkpoint', 'Test checkpoint'],
        expect.any(Object)
      );
    });

    test('calls mem_learn with insight', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      const result = server.callTool('mem_learn', { insight: 'Test insight' });
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['learn', 'Test insight'],
        expect.any(Object)
      );
    });

    test('calls mem_learn with global flag', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      const result = server.callTool('mem_learn', { insight: 'Global insight', global: true });
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['learn', '-g', 'Global insight'],
        expect.any(Object)
      );
    });

    test('calls mem_next with step', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      server.callTool('mem_next', { step: 'Next step' });
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['next', 'Next step'],
        expect.any(Object)
      );
    });

    test('calls mem_stuck with reason', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      server.callTool('mem_stuck', { reason: 'Blocked reason' });
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['stuck', 'Blocked reason'],
        expect.any(Object)
      );
    });

    test('calls mem_goal to get current goal', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'Current goal', stderr: '' });
      const result = server.callTool('mem_goal', {});
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['goal'],
        expect.any(Object)
      );
    });

    test('calls mem_goal to set new goal', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      server.callTool('mem_goal', { goal: 'New goal' });
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['goal', 'New goal'],
        expect.any(Object)
      );
    });

    test('calls mem_tasks', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'task list', stderr: '' });
      server.callTool('mem_tasks', {});
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['tasks'],
        expect.any(Object)
      );
    });

    test('calls mem_switch with task name', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      server.callTool('mem_switch', { task: 'feature-branch' });
      expect(spawnSync).toHaveBeenCalledWith(
        'mem',
        ['switch', 'feature-branch'],
        expect.any(Object)
      );
    });

    test('returns error for unknown tool', () => {
      const result = server.callTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    test('returns error when command fails', () => {
      spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'Command failed' });
      const result = server.callTool('mem_status', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });
  });

  describe('handleMessage', () => {
    test('handles initialize method', () => {
      const message = { id: 1, method: 'initialize', params: {} };
      const response = server.handleMessage(message);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.serverInfo.name).toBe('mem');
    });

    test('handles tools/list method', () => {
      const message = { id: 2, method: 'tools/list', params: {} };
      const response = server.handleMessage(message);
      expect(response.id).toBe(2);
      expect(response.result).toHaveProperty('tools');
    });

    test('handles tools/call method', () => {
      spawnSync.mockReturnValue({ status: 0, stdout: 'Success', stderr: '' });
      const message = {
        id: 3,
        method: 'tools/call',
        params: { name: 'mem_status', arguments: {} }
      };
      const response = server.handleMessage(message);
      expect(response.id).toBe(3);
      expect(response.result.content[0].text).toBe('Success');
      expect(response.result.isError).toBe(false);
    });

    test('handles tools/call with error', () => {
      spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'Failed' });
      const message = {
        id: 4,
        method: 'tools/call',
        params: { name: 'mem_status', arguments: {} }
      };
      const response = server.handleMessage(message);
      expect(response.result.content[0].text).toContain('Error');
      expect(response.result.isError).toBe(true);
    });

    test('handles notifications/initialized', () => {
      const message = { method: 'notifications/initialized' };
      const response = server.handleMessage(message);
      expect(response).toBeNull();
    });

    test('handles unknown method', () => {
      const message = { id: 5, method: 'unknown/method', params: {} };
      const response = server.handleMessage(message);
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toContain('Method not found');
    });
  });
});
