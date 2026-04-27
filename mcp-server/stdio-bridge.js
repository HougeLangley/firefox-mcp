#!/usr/bin/env node
/**
 * Firefox MCP - STDIO Bridge for mcporter
 * 
 * 将 MCP STDIO 协议转换为 WebSocket 协议
 * 让 mcporter 可以调用现有的 Firefox MCP WebSocket 服务器
 */

const WebSocket = require('ws');

const MCP_SERVER_URL = 'ws://localhost:34567/client';

class StdioBridge {
  constructor() {
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MCP_SERVER_URL);
      
      this.ws.on('open', () => {
        console.error('[Bridge] Connected to Firefox MCP server');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          // 转发响应到 stdout
          console.log(JSON.stringify(msg));
        } catch (e) {
          console.error('[Bridge] Parse error:', e.message);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[Bridge] WebSocket error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.error('[Bridge] Connection closed');
        process.exit(0);
      });
    });
  }

  start() {
    // 发送初始化响应
    const initResponse = {
      jsonrpc: '2.0',
      id: 0,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'firefox-mcp',
          version: '1.0.0'
        }
      }
    };
    console.log(JSON.stringify(initResponse));

    // 发送工具列表
    const toolsList = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        tools: [
          {
            name: 'firefox_navigate',
            description: 'Navigate to URL',
            inputSchema: {
              type: 'object',
              properties: { url: { type: 'string' } },
              required: ['url']
            }
          },
          {
            name: 'firefox_get_tabs',
            description: 'Get all tabs',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'firefox_get_current_url',
            description: 'Get current URL',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'firefox_get_page_title',
            description: 'Get page title',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'firefox_get_page_content',
            description: 'Get page content',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'firefox_click',
            description: 'Click element by selector',
            inputSchema: {
              type: 'object',
              properties: { selector: { type: 'string' } },
              required: ['selector']
            }
          },
          {
            name: 'firefox_type',
            description: 'Type text into element',
            inputSchema: {
              type: 'object',
              properties: {
                selector: { type: 'string' },
                text: { type: 'string' },
                submit: { type: 'boolean' }
              },
              required: ['selector', 'text']
            }
          },
          {
            name: 'firefox_screenshot',
            description: 'Take screenshot',
            inputSchema: {
              type: 'object',
              properties: { fullPage: { type: 'boolean' } }
            }
          },
          {
            name: 'firefox_execute_js',
            description: 'Execute JavaScript code',
            inputSchema: {
              type: 'object',
              properties: { code: { type: 'string' } },
              required: ['code']
            }
          },
          {
            name: 'firefox_wait',
            description: 'Wait for duration',
            inputSchema: {
              type: 'object',
              properties: { duration: { type: 'number' } },
              required: ['duration']
            }
          }
        ]
      }
    };
    console.log(JSON.stringify(toolsList));

    // 监听 stdin
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      try {
        const lines = data.trim().split('\n');
        for (const line of lines) {
          if (!line) continue;
          
          const msg = JSON.parse(line);
          
          // 处理初始化请求
          if (msg.method === 'initialize') {
            const response = {
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: {}
                },
                serverInfo: {
                  name: 'firefox-mcp',
                  version: '1.0.0'
                }
              }
            };
            console.log(JSON.stringify(response));
            continue;
          }
          
          // 处理工具列表请求
          if (msg.method === 'tools/list') {
            console.log(JSON.stringify(toolsList));
            continue;
          }
          
          // 处理工具调用
          if (msg.method === 'tools/call') {
            this.forwardToWebSocket(msg);
            continue;
          }
          
          // 其他请求直接转发
          this.forwardToWebSocket(msg);
        }
      } catch (e) {
        console.error('[Bridge] Error:', e.message);
      }
    });

    process.stdin.on('end', () => {
      console.error('[Bridge] STDIN closed');
      this.disconnect();
    });
  }

  forwardToWebSocket(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.error('[Bridge] WebSocket not connected');
      const error = {
        jsonrpc: '2.0',
        id: msg.id,
        error: {
          code: -32000,
          message: 'WebSocket not connected'
        }
      };
      console.log(JSON.stringify(error));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    process.exit(0);
  }
}

// 主程序
async function main() {
  const bridge = new StdioBridge();
  
  try {
    await bridge.connect();
    bridge.start();
  } catch (err) {
    console.error('[Bridge] Failed to connect:', err.message);
    console.error('[Bridge] Make sure Firefox MCP server is running on port 34567');
    process.exit(1);
  }
}

main();
