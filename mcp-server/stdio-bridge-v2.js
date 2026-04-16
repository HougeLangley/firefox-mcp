#!/usr/bin/env node
/**
 * Firefox MCP - STDIO Bridge for mcporter (v2)
 * 
 * 将 MCP STDIO 协议转换为 WebSocket 协议
 */

const WebSocket = require('ws');

const MCP_SERVER_URL = 'ws://localhost:34567/client';

class StdioBridge {
  constructor() {
    this.ws = null;
    this.messageQueue = [];
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MCP_SERVER_URL);
      
      this.ws.on('open', () => {
        console.error('[Bridge] Connected to Firefox MCP');
        this.connected = true;
        this.flushQueue();
        resolve();
      });

      this.ws.on('message', (data) => {
        // 将 WebSocket 响应转发到 stdout
        process.stdout.write(data.toString() + '\n');
      });

      this.ws.on('error', (err) => {
        console.error('[Bridge] Error:', err.message);
        if (!this.connected) {
          reject(err);
        }
      });

      this.ws.on('close', () => {
        console.error('[Bridge] Connection closed');
        process.exit(0);
      });
    });
  }

  flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      this.ws.send(JSON.stringify(msg));
    }
  }

  send(msg) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  start() {
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      
      // 处理完整的 JSON 行
      let lines = buffer.split('\n');
      buffer = lines.pop(); // 保留不完整的行
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const msg = JSON.parse(line);
          this.send(msg);
        } catch (e) {
          console.error('[Bridge] Parse error:', e.message);
        }
      }
    });

    process.stdin.on('end', () => {
      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer);
          this.send(msg);
        } catch (e) {
          console.error('[Bridge] Parse error:', e.message);
        }
      }
      this.ws.close();
    });
  }
}

// 主程序
async function main() {
  const bridge = new StdioBridge();
  
  try {
    await bridge.connect();
    bridge.start();
  } catch (err) {
    console.error('[Bridge] Connection failed:', err.message);
    console.error('[Bridge] Is Firefox MCP server running? (systemctl --user status firefox-mcp)');
    process.exit(1);
  }
}

main();
