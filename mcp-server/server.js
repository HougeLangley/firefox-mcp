#!/usr/bin/env node
/**
 * OpenClaw Firefox MCP - MCP Server
 * Implements Model Context Protocol for Firefox browser automation
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
  console.error('[MCP Server]', ...args);
}

function error(...args) {
  console.error('[MCP Server Error]', ...args);
}

// Tool definitions
const TOOLS = [
  {
    name: 'firefox_navigate',
    description: 'Navigate to a URL in the active tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to navigate to'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'firefox_get_tabs',
    description: 'Get list of all tabs',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'firefox_switch_tab',
    description: 'Switch to a specific tab',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Tab ID to switch to'
        }
      },
      required: ['tabId']
    }
  },
  {
    name: 'firefox_close_tab',
    description: 'Close a tab',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Tab ID to close (optional, closes active tab if not specified)'
        }
      }
    }
  },
  {
    name: 'firefox_new_tab',
    description: 'Open a new tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to open in new tab (optional)'
        }
      }
    }
  },
  {
    name: 'firefox_get_current_url',
    description: 'Get URL of active tab',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'firefox_get_page_title',
    description: 'Get title of active tab',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'firefox_get_page_content',
    description: 'Get text and HTML content of active page',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'firefox_click',
    description: 'Click an element by CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for element to click'
        }
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
        selector: {
          type: 'string',
          description: 'CSS selector for input element'
        },
        text: {
          type: 'string',
          description: 'Text to type'
        },
        submit: {
          type: 'boolean',
          description: 'Whether to submit the form after typing'
        }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'firefox_screenshot',
    description: 'Take a screenshot of the active tab',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: {
          type: 'boolean',
          description: 'Whether to capture full page (default: false)'
        }
      }
    }
  },
  {
    name: 'firefox_execute_js',
    description: 'Execute JavaScript in the active tab',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute'
        }
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
        duration: {
          type: 'number',
          description: 'Duration in seconds'
        }
      },
      required: ['duration']
    }
  }
];

// Pending requests from Firefox
const pendingRequests = new Map();
let requestId = 0;

// Forward request to Firefox extension and wait for response
function forwardToFirefox(tool, params) {
  return new Promise((resolve, reject) => {
    const id = `req_${++requestId}_${Date.now()}`;
    
    // Set timeout
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timeout'));
    }, 30000);
    
    pendingRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    });
    
    // Send to stdout (Native Host will forward to Firefox)
    const message = {
      id,
      type: 'request',
      tool,
      params
    };
    
    console.log(JSON.stringify(message));
  });
}

// Handle response from Firefox
function handleFirefoxResponse(message) {
  const { id, result, error: err } = message;
  
  if (pendingRequests.has(id)) {
    const { resolve, reject } = pendingRequests.get(id);
    pendingRequests.delete(id);
    
    if (err) {
      reject(new Error(err));
    } else {
      resolve(result);
    }
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'firefox-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  log('Tool called:', name, args);
  
  // Check if tool exists
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Tool not found: ${name}`
    );
  }
  
  try {
    // Forward to Firefox extension
    const result = await forwardToFirefox(name, args || {});
    
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (err) {
    error('Tool execution failed:', err.message);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${err.message}`
        }
      ],
      isError: true
    };
  }
});

// Read messages from stdin (from Native Host)
let buffer = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  log('Received data from stdin:', chunk.length, 'bytes');
  buffer += chunk;
  
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      log('Processing line:', line.substring(0, 100));
      try {
        const message = JSON.parse(line);
        log('Parsed message:', message.type, message.id);
        
        if (message.type === 'response') {
          handleFirefoxResponse(message);
        } else if (message.type === 'handshake') {
          log('Handshake from Firefox:', message.version);
        } else {
          log('Unknown message type:', message.type);
        }
      } catch (err) {
        error('Failed to parse message:', err.message);
      }
    }
  }
});

// Start server
async function main() {
  log('Starting MCP server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  log('MCP server running on stdio');
}

main().catch((err) => {
  error('Fatal error:', err);
  process.exit(1);
});
