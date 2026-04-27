const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:34567/client');

ws.on('open', () => {
  // Send initialize
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05' }
  }));
  
  // Send tool call with proper params
  setTimeout(() => {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'firefox_navigate',
        arguments: { url: 'https://example.com' }
      }
    }));
  }, 1000);
});

ws.on('message', (data) => {
  console.log('Response:', data.toString());
});

ws.on('error', (err) => {
  console.error('Error:', err.message);
});

setTimeout(() => ws.close(), 5000);