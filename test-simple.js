#!/usr/bin/env node
/**
 * Simple test for Native Host communication
 */

// Simulate Native Host receiving a message from Firefox
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

// Write to stdout (simulating Firefox sending to Native Host)
process.stdout.write(header);
process.stdout.write(buffer);

console.error('Sent message to Native Host');

// Keep alive
setTimeout(() => {}, 5000);
