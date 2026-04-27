#!/usr/bin/env node
/**
 * OpenClaw Firefox MCP - Simplified Native Messaging Host
 * Directly implements MCP protocol without separate server process
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} = require('@modelcontextprotocol/sdk/types.js');

// Logger (to stderr, stdout is for MCP protocol)
function log(...args) {
  console.error('[Native Host]', ...args);
}

function error(...args) {
  console.error('[Native Host Error]', ...args);
}

// Native Messaging protocol for Firefox
let firefoxPort = { write: () => {} }; // Placeholder
const pendingFirefoxRequests = new Map();
let firefoxRequestId = 0;

function sendToFirefox(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32LE(buffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(buffer);
}

function forwardToFirefox(tool, params) {
  return new Promise((resolve, reject) => {
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
    
    sendToFirefox({
      id,
      type: 'request',
      tool,
      params
    });
  });
}

// Tool definitions
const TOOLS = [
  {
    name: 'firefox_navigate',
    description: 'Navigate to a URL in the active tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' }
      },
      required: ['url']
    }
  },
  {
    name: 'firefox_get_tabs',
    description: 'Get list of all tabs',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'firefox_get_current_url',
    description: 'Get URL of active tab',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'firefox_get_page_title',
    description: 'Get title of active tab',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'firefox_get_page_content',
    description: 'Get text and HTML content of active page',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'firefox_click',
    description: 'Click an element by CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' }
      },
      required: ['selector']
    }
  },
  {
    name: 'firefox_type',
    description: 'Type text into an input element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        text: { type: 'string', description: 'Text to type' },
        submit: { type: 'boolean', description: 'Submit form after typing' }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'firefox_screenshot',
    description: 'Take a screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'Capture full page' }
      }
    }
  },
  {
    name: 'firefox_execute_js',
    description: 'Execute JavaScript',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code' }
      },
      required: ['code']
    }
  },
  {
    name: 'firefox_wait',
    description: 'Wait for specified duration',
    inputSchema: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: 'Duration in seconds' }
      },
      required: ['duration']
    }
  }
];

// Create MCP server
const server = new Server(
  { name: 'firefox-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  log('Tool called:', name);
  
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) {
    throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
  }
  
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

// Read messages from Firefox (Native Messaging protocol)
let nativeBuffer = Buffer.alloc(0);

process.stdin.on('readable', () => {
  const chunk = process.stdin.read();
  if (!chunk) return;
  
  nativeBuffer = Buffer.concat([nativeBuffer, chunk]);
  
  while (nativeBuffer.length >= 4) {
    const messageLength = nativeBuffer.readUInt32LE(0);
    
    if (nativeBuffer.length < 4 + messageLength) break;
    
    const messageJson = nativeBuffer.slice(4, 4 + messageLength).toString('utf8');
    nativeBuffer = nativeBuffer.slice(4 + messageLength);
    
    try {
      const message = JSON.parse(messageJson);
      log('Received from Firefox:', message.type, message.id);
      
      if (message.id && pendingFirefoxRequests.has(message.id)) {
        const { resolve, reject } = pendingFirefoxRequests.get(message.id);
        pendingFirefoxRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
      } else if (message.type === 'handshake') {
        log('Handshake from Firefox:', message.version);
      }
    } catch (err) {
      error('Failed to parse Firefox message:', err.message);
    }
  }
});

process.stdin.on('end', () => {
  log('Firefox disconnected');
  process.exit(0);
});

// Start MCP server
async function main() {
  log('Starting Native Host with integrated MCP server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  log('MCP server ready, waiting for Firefox...');
}

main().catch(err => {
  error('Fatal error:', err);
  process.exit(1);
});
