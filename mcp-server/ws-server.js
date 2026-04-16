#!/usr/bin/env node
/**
 * OpenClaw Firefox MCP - WebSocket Server
 * Uses WebSocket as MCP transport (non-standard but simpler)
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 34567;

// Logger
function log(...args) {
  console.error('[WS Server]', ...args);
}

// State
let firefoxWs = null;
let clientWs = null;
let requestId = 0;
const pendingRequests = new Map();

// Tool definitions
const TOOLS = [
  { name: 'firefox_navigate', description: 'Navigate to URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'firefox_get_tabs', description: 'Get all tabs', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_get_current_url', description: 'Get current URL', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_get_page_title', description: 'Get page title', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_get_page_content', description: 'Get page content', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_click', description: 'Click element', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'firefox_type', description: 'Type text', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' }, submit: { type: 'boolean' } }, required: ['selector', 'text'] } },
  { name: 'firefox_screenshot', description: 'Take screenshot', inputSchema: { type: 'object', properties: { fullPage: { type: 'boolean' } } } },
  { name: 'firefox_execute_js', description: 'Execute JS', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'firefox_wait', description: 'Wait', inputSchema: { type: 'object', properties: { duration: { type: 'number' } }, required: ['duration'] } }
];

// HTTP server for health checks
const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      firefoxConnected: !!firefoxWs,
      clientConnected: !!clientWs
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

// WebSocket server
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = req.url;
  log('New connection:', url);
  
  if (url === '/firefox') {
    // Firefox extension
    firefoxWs = ws;
    log('Firefox connected');
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        log('From Firefox:', msg.type, msg.id);
        
        // Forward to client if it's a response
        if (msg.type === 'response' && clientWs) {
          clientWs.send(JSON.stringify(msg));
        }
      } catch (e) {
        log('Invalid message from Firefox:', e.message);
      }
    });
    
    ws.on('close', () => {
      log('Firefox disconnected');
      firefoxWs = null;
    });
    
    ws.send(JSON.stringify({ type: 'handshake', version: '1.0.0' }));
    
  } else if (url === '/client') {
    // MCP client (mcporter)
    clientWs = ws;
    log('Client connected');
    
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);
        log('From client:', msg.method, msg.id);
        
        if (msg.method === 'initialize') {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              serverInfo: { name: 'firefox-mcp', version: '1.0.0' }
            }
          }));
        } else if (msg.method === 'tools/list') {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: { tools: TOOLS }
          }));
        } else if (msg.method === 'tools/call') {
          const { name, arguments: args } = msg.params;
          
          if (!firefoxWs) {
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32000, message: 'Firefox not connected' }
            }));
            return;
          }
          
          // Forward to Firefox
          const reqId = `req_${++requestId}_${Date.now()}`;
          
          const timeout = setTimeout(() => {
            pendingRequests.delete(reqId);
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32000, message: 'Request timeout' }
            }));
          }, 30000);
          
          pendingRequests.set(reqId, {
            clientId: msg.id,
            clientWs: ws,
            resolve: (result) => {
              clearTimeout(timeout);
              pendingRequests.delete(reqId);
              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                }
              }));
            },
            reject: (err) => {
              clearTimeout(timeout);
              pendingRequests.delete(reqId);
              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32000, message: err.message }
              }));
            }
          });
          
          firefoxWs.send(JSON.stringify({
            id: reqId,
            type: 'request',
            tool: name,
            params: args || {}
          }));
        }
      } catch (e) {
        log('Invalid message from client:', e.message);
      }
    });
    
    ws.on('close', () => {
      log('Client disconnected');
      clientWs = null;
    });
    
  } else {
    log('Unknown connection path:', url);
    ws.close();
  }
});

// Handle responses from Firefox
function handleFirefoxResponse(message) {
  log('handleFirefoxResponse:', message.id, pendingRequests.has(message.id));
  if (message.id && pendingRequests.has(message.id)) {
    const { resolve, reject } = pendingRequests.get(message.id);
    
    if (message.error) {
      reject(new Error(message.error));
    } else {
      resolve(message.result);
    }
  }
}

httpServer.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
  log(`Firefox: ws://localhost:${PORT}/firefox`);
  log(`Client: ws://localhost:${PORT}/client`);
});
