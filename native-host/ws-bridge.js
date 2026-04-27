#!/usr/bin/env node
/**
 * WebSocket to STDIO bridge for mcporter
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:34567/client';

let ws = null;
let buffer = '';

function log(...args) {
  console.error('[WS Bridge]', ...args);
}

function connect() {
  log('Connecting to', WS_URL);
  
  ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    log('Connected');
  });
  
  ws.on('message', (data) => {
    // Forward to stdout (MCP protocol)
    const msg = data.toString();
    console.log(msg);
  });
  
  ws.on('close', () => {
    log('Disconnected');
    process.exit(0);
  });
  
  ws.on('error', (err) => {
    log('Error:', err.message);
    process.exit(1);
  });
}

// Read from stdin
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  
  const lines = buffer.split('\n');
  buffer = lines.pop();
  
  for (const line of lines) {
    if (line.trim() && ws?.readyState === WebSocket.OPEN) {
      ws.send(line);
    }
  }
});

process.stdin.on('end', () => {
  if (ws) ws.close();
});

connect();
