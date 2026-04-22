#!/usr/bin/env node
/**
 * OpenClaw Firefox MCP - WebSocket Server (Simplified)
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 34567;

function log(...args) {
  console.error('[WS Server]', ...args);
}

let firefoxWs = null;

const TOOLS = [
  { name: 'firefox_navigate', description: 'Navigate to URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'firefox_get_tabs', description: 'Get all tabs', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_get_current_url', description: 'Get current URL', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_get_page_title', description: 'Get page title', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_get_page_content', description: 'Get page content', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_click', description: 'Click element', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'firefox_type', description: 'Type text', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' }, submit: { type: 'boolean' } }, required: ['selector', 'text'] } },
  { name: 'firefox_scroll', description: 'Scroll page', inputSchema: { type: 'object', properties: { direction: { type: 'string' }, pixels: { type: 'number' } } } },
  { name: 'firefox_press_key', description: 'Press keyboard key', inputSchema: { type: 'object', properties: { key: { type: 'string' }, selector: { type: 'string' } }, required: ['key'] } },
  { name: 'firefox_select', description: 'Select dropdown option', inputSchema: { type: 'object', properties: { selector: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'value'] } },
  { name: 'firefox_clear', description: 'Clear input field', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'firefox_hover', description: 'Hover over element', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
  { name: 'firefox_refresh', description: 'Refresh page', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_go_back', description: 'Go back in history', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_go_forward', description: 'Go forward in history', inputSchema: { type: 'object', properties: {} } },
  { name: 'firefox_screenshot', description: 'Take screenshot', inputSchema: { type: 'object', properties: { fullPage: { type: 'boolean' } } } },
  { name: 'firefox_execute_js', description: 'Execute JS', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'firefox_wait', description: 'Wait', inputSchema: { type: 'object', properties: { duration: { type: 'number' } }, required: ['duration'] } }
];

// Pending requests: clientId -> { clientWs, resolve, reject }
const pending = new Map();

const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', firefoxConnected: !!firefoxWs }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = req.url;
  log('New connection:', url);
  
  if (url === '/firefox') {
    firefoxWs = ws;
    log('Firefox connected');
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        log('From Firefox:', msg.id, msg.type);
        
        if (msg.type === 'response' && pending.has(msg.id)) {
          const { clientWs, clientId, resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          
          if (msg.error) {
            clientWs.send(JSON.stringify({
              jsonrpc: '2.0',
              id: clientId,
              error: { code: -32000, message: msg.error }
            }));
          } else {
            clientWs.send(JSON.stringify({
              jsonrpc: '2.0',
              id: clientId,
              result: {
                content: [{ type: 'text', text: JSON.stringify(msg.result, null, 2) }]
              }
            }));
          }
        }
      } catch (e) {
        log('Error handling Firefox message:', e.message);
      }
    });
    
    ws.on('close', () => {
      log('Firefox disconnected');
      firefoxWs = null;
    });
    
    ws.send(JSON.stringify({ type: 'handshake', version: '1.0.0' }));
    
  } else if (url === '/client') {
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
          if (!firefoxWs) {
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32000, message: 'Firefox not connected' }
            }));
            return;
          }
          
          const reqId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const timeout = setTimeout(() => {
            if (pending.has(reqId)) {
              pending.delete(reqId);
              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32000, message: 'Request timeout' }
              }));
            }
          }, 30000);
          
          pending.set(reqId, {
            clientWs: ws,
            clientId: msg.id,
            resolve: () => {},
            reject: () => {}
          });
          
          log('Sending to Firefox:', reqId, msg.params.name);
          firefoxWs.send(JSON.stringify({
            id: reqId,
            type: 'request',
            tool: msg.params.name,
            params: msg.params.arguments || {}
          }));
        }
      } catch (e) {
        log('Error handling client message:', e.message);
      }
    });
    
    ws.on('close', () => {
      log('Client disconnected');
    });
  }
});

httpServer.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
});
