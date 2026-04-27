#!/usr/bin/env node
/**
 * Firefox MCP - STDIO Bridge for mcporter (v3)
 * 
 * 自动启动 WebSocket 服务器并连接
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

const MCP_SERVER_URL = 'ws://localhost:34567/client';
const SERVER_SCRIPT = path.join(__dirname, 'ws-server-v2.js');

class StdioBridge {
  constructor() {
    this.ws = null;
    this.messageQueue = [];
    this.connected = false;
    this.serverProcess = null;
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      console.error('[Bridge] Starting WebSocket server...');
      
      this.serverProcess = spawn('node', [SERVER_SCRIPT], {
        detached: true,
        stdio: 'ignore'
      });
      
      this.serverProcess.on('error', (err) => {
        console.error('[Bridge] Failed to start server:', err.message);
        reject(err);
      });
      
      // 等待服务器启动
      setTimeout(() => {
        console.error('[Bridge] Server started, PID:', this.serverProcess.pid);
        resolve();
      }, 2000);
    });
  }

  async connect() {
    // 先尝试连接，如果失败则启动服务器
    let retries = 0;
    const maxRetries = 2;
    
    while (retries < maxRetries) {
      try {
        await this.tryConnect();
        return; // 连接成功
      } catch (err) {
        retries++;
        console.error(`[Bridge] Connection attempt ${retries} failed`);
        
        if (retries === 1) {
          // 第一次失败，尝试启动服务器
          try {
            await this.startServer();
          } catch (startErr) {
            console.error('[Bridge] Failed to start server:', startErr.message);
            throw startErr;
          }
        } else {
          // 第二次失败，抛出错误
          throw err;
        }
      }
    }
  }

  async tryConnect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MCP_SERVER_URL);
      
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);
      
      this.ws.on('open', () => {
        clearTimeout(timeout);
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
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on('close', () => {
        console.error('[Bridge] Connection closed');
        this.connected = false;
        // 如果服务器进程还在，杀掉它
        if (this.serverProcess) {
          this.serverProcess.kill();
        }
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
    console.error('[Bridge] Failed:', err.message);
    process.exit(1);
  }
}

main();
