#!/usr/bin/env node
/**
 * OpenClaw Firefox MCP - HTTP Server
 * Firefox extension connects via HTTP/WebSocket
 */

const http = require('http');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const PORT = 34567;

// Logger
function log(...args) {
  console.error('[HTTP Server]', ...args);
}

// Store pending requests from Firefox
const pendingFirefoxRequests = new Map();
let firefoxRequestId = 0;
let firefoxWs = null;

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

function forwardToFirefox(tool, params) {
  return new Promise((resolve, reject) => {
    if (!firefoxWs) {
      reject(new Error('Firefox not connected'));
      return;
    }
    
    const id = `req_${++firefoxRequestId}_${Date.now()}`;
    
    const timeout = setTimeout(() => {
      pendingFirefoxRequests.delete(id);
      reject(new Error('Firefox request timeout'));
    }, 30000);
    
    pendingFirefoxRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    });
    
    firefoxWs.send(JSON.stringify({
      id,
      type: 'request',
      tool,
      params
    }));
  });
}

// Create MCP server for each connection
function createMcpServer() {
  const mcpServer = new Server(
    { name: 'firefox-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log('Tool called:', name);
    
    try {
      const result = await forwardToFirefox(name, args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  });
  
  return mcpServer;
}

// HTTP server
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // MCP SSE endpoint
  if (req.url === '/mcp') {
    const transport = new SSEServerTransport('/mcp-message', res);
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    log('MCP client connected via SSE');
    return;
  }
  
  // WebSocket upgrade for Firefox
  if (req.url === '/firefox') {
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('WebSocket required');
    return;
  }
  
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      firefoxConnected: !!firefoxWs
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

// WebSocket server for Firefox
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server, path: '/firefox' });

wss.on('connection', (ws) => {
  log('Firefox connected via WebSocket');
  firefoxWs = ws;
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      log('Received from Firefox:', message.type, message.id);
      
      if (message.id && pendingFirefoxRequests.has(message.id)) {
        const { resolve, reject } = pendingFirefoxRequests.get(message.id);
        pendingFirefoxRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
      }
    } catch (err) {
      log('Failed to parse message:', err.message);
    }
  });
  
  ws.on('close', () => {
    log('Firefox disconnected');
    firefoxWs = null;
  });
  
  ws.on('error', (err) => {
    log('WebSocket error:', err.message);
    firefoxWs = null;
  });
  
  // Send handshake
  ws.send(JSON.stringify({ type: 'handshake', version: '1.0.0' }));
});

server.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
  log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  log(`Firefox WebSocket: ws://localhost:${PORT}/firefox`);
});
