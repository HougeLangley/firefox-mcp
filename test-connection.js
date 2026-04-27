#!/usr/bin/env node
/**
 * Test script for Firefox MCP connection
 */

const { spawn } = require('child_process');
const path = require('path');

const HOST_PATH = path.join(__dirname, 'native-host', 'host.js');

console.log('Testing Firefox MCP connection...\n');

// Start the host
const host = spawn('node', [HOST_PATH], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdoutBuffer = Buffer.alloc(0);

// Handle stdout (Native Messaging protocol)
host.stdout.on('data', (data) => {
  stdoutBuffer = Buffer.concat([stdoutBuffer, data]);
  
  while (stdoutBuffer.length >= 4) {
    const messageLength = stdoutBuffer.readUInt32LE(0);
    
    if (stdoutBuffer.length < 4 + messageLength) break;
    
    const message = stdoutBuffer.slice(4, 4 + messageLength).toString('utf8');
    stdoutBuffer = stdoutBuffer.slice(4 + messageLength);
    
    try {
      const parsed = JSON.parse(message);
      console.log('Received:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Raw:', message);
    }
  }
});

// Handle stderr (logs)
host.stderr.on('data', (data) => {
  console.log('[Host Log]', data.toString().trim());
});

// Handle exit
host.on('exit', (code) => {
  console.log(`\nHost exited with code ${code}`);
  process.exit(code);
});

// Send a test message after 2 seconds
setTimeout(() => {
  console.log('\nSending test message...\n');
  
  const message = {
    id: 'test-1',
    type: 'request',
    tool: 'firefox_get_tabs',
    params: {}
  };
  
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32LE(buffer.length, 0);
  
  host.stdin.write(header);
  host.stdin.write(buffer);
}, 2000);

// Exit after 5 seconds
setTimeout(() => {
  console.log('\nTest complete, shutting down...');
  host.kill();
}, 5000);
