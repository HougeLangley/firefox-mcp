#!/usr/bin/env node
/**
 * OpenClaw Firefox MCP - Native Messaging Host
 * Bridges Firefox Extension ↔ MCP Server via stdio
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuration
const MCP_SERVER_PATH = path.join(__dirname, '..', 'mcp-server', 'server.js');

// Logger (to stderr, stdout is for Native Messaging)
function log(...args) {
  console.error('[Native Host]', ...args);
}

function error(...args) {
  console.error('[Native Host Error]', ...args);
}

// Native Messaging protocol helpers
function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32LE(buffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(buffer);
}

function readMessages(callback) {
  let buffer = Buffer.alloc(0);
  let messageLength = null;

  process.stdin.on('readable', () => {
    const chunk = process.stdin.read();
    if (chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      
      while (true) {
        if (messageLength === null) {
          if (buffer.length < 4) break;
          messageLength = buffer.readUInt32LE(0);
          buffer = buffer.slice(4);
        }
        
        if (buffer.length < messageLength) break;
        
        const message = buffer.slice(0, messageLength).toString('utf8');
        buffer = buffer.slice(messageLength);
        messageLength = null;
        
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (err) {
          error('Failed to parse message:', err.message);
        }
      }
    }
  });

  process.stdin.on('end', () => {
    log('stdin ended');
    process.exit(0);
  });
}

// MCP Server process
let mcpProcess = null;

function startMcpServer() {
  log('Starting MCP server...');
  
  mcpProcess = spawn('node', [MCP_SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcpProcess.on('error', (err) => {
    error('MCP server failed to start:', err.message);
    sendMessage({
      type: 'error',
      error: `MCP server failed: ${err.message}`
    });
  });

  mcpProcess.on('exit', (code) => {
    log('MCP server exited with code:', code);
    mcpProcess = null;
  });

  // Forward MCP server stdout to Firefox extension
  let stdoutBuffer = '';
  mcpProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // Keep incomplete line
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          sendMessage(parsed);
        } catch (err) {
          error('Failed to parse MCP output:', err.message, 'Line:', line.substring(0, 100));
        }
      }
    }
  });

  // Log MCP server stderr
  mcpProcess.stderr.on('data', (data) => {
    log('[MCP]', data.toString().trim());
  });

  log('MCP server started');
}

function stopMcpServer() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

function sendToMcp(message) {
  if (!mcpProcess) {
    error('MCP server not running');
    sendMessage({
      type: 'error',
      error: 'MCP server not running'
    });
    return;
  }
  
  mcpProcess.stdin.write(JSON.stringify(message) + '\n');
}

// Main
log('Native Messaging Host started');
log('MCP Server path:', MCP_SERVER_PATH);

// Start MCP server
startMcpServer();

// Handle messages from Firefox extension
readMessages((message) => {
  log('Received from Firefox:', message.type || message.tool);
  
  // Forward to MCP server
  sendToMcp(message);
});

// Cleanup on exit
process.on('SIGINT', () => {
  log('SIGINT received');
  stopMcpServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('SIGTERM received');
  stopMcpServer();
  process.exit(0);
});
