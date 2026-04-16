#!/usr/bin/env node
/**
 * Firefox MCP 客户端 - 修复版
 * 使用正确的 WebSocket 协议
 */

const WebSocket = require('ws');

const MCP_SERVER = 'ws://localhost:34567/client';

class MCPClient {
  constructor() {
    this.ws = null;
    this.requestId = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MCP_SERVER);
      
      this.ws.on('open', () => {
        console.error('[MCP] Connected');
        resolve();
      });

      this.ws.on('error', (err) => {
        console.error('[MCP] Connection error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.error('[MCP] Connection closed');
      });
    });
  }

  async callTool(name, args = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name,
          arguments: args
        }
      };

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      const messageHandler = (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.id === id) {
            clearTimeout(timeout);
            this.ws.off('message', messageHandler);
            
            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result);
            }
          }
        } catch (e) {
          // Ignore parse errors for other messages
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(JSON.stringify(request));
    });
  }

  async navigate(url) {
    return this.callTool('firefox_navigate', { url });
  }

  async executeJS(code) {
    return this.callTool('firefox_execute_js', { code });
  }

  async scrollDown(pixels = 800) {
    return this.executeJS(`window.scrollBy(0, ${pixels}); "Scrolled ${pixels}px"`);
  }

  async scrollUp(pixels = 800) {
    return this.executeJS(`window.scrollBy(0, -${pixels}); "Scrolled -${pixels}px"`);
  }

  async click(x, y) {
    return this.executeJS(`
      const el = document.elementFromPoint(${x}, ${y});
      if (el) {
        el.click();
        { success: true, x: ${x}, y: ${y}, element: el.tagName }
      } else {
        { error: 'No element at position', x: ${x}, y: ${y} }
      }
    `);
  }

  async type(text) {
    // 转义特殊字符
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return this.executeJS(`
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        el.value = "${escaped}";
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        { success: true }
      } else {
        { error: 'No active input element' }
      }
    `);
  }

  async getContent() {
    return this.callTool('firefox_get_page_content', {});
  }

  async getUrl() {
    return this.callTool('firefox_get_current_url', {});
  }

  async getTitle() {
    return this.callTool('firefox_get_page_title', {});
  }

  async screenshot(fullPage = false) {
    return this.callTool('firefox_screenshot', { fullPage });
  }

  async wait(ms) {
    return this.callTool('firefox_wait', { duration: ms });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// CLI 模式
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log('Firefox MCP 控制工具');
    console.log('');
    console.log('用法: mcp <命令> [参数]');
    console.log('');
    console.log('命令:');
    console.log('  navigate <url>     导航到指定 URL');
    console.log('  scroll [pixels]    向下滚动（默认 800px）');
    console.log('  scrollup [pixels]  向上滚动（默认 800px）');
    console.log('  click <x> <y>      在指定坐标点击');
    console.log('  type <text>        在活动输入框输入文本');
    console.log('  content            获取页面内容');
    console.log('  url                获取当前 URL');
    console.log('  title              获取页面标题');
    console.log('  screenshot         截图');
    console.log('  wait <ms>          等待指定毫秒');
    console.log('  js <code>          执行 JavaScript');
    console.log('');
    console.log('示例:');
    console.log('  mcp navigate https://phoronix.com');
    console.log('  mcp scroll');
    console.log('  mcp click 500 300');
    console.log('  mcp type "Hello World"');
    process.exit(0);
  }

  const client = new MCPClient();
  
  try {
    await client.connect();
    
    let result;
    switch (command) {
      case 'navigate':
        result = await client.navigate(args[1]);
        break;
      case 'scroll':
        result = await client.scrollDown(parseInt(args[1]) || 800);
        break;
      case 'scrollup':
        result = await client.scrollUp(parseInt(args[1]) || 800);
        break;
      case 'click':
        result = await client.click(parseInt(args[1]), parseInt(args[2]));
        break;
      case 'type':
        result = await client.type(args.slice(1).join(' '));
        break;
      case 'content':
        result = await client.getContent();
        break;
      case 'url':
        result = await client.getUrl();
        break;
      case 'title':
        result = await client.getTitle();
        break;
      case 'screenshot':
        result = await client.screenshot();
        break;
      case 'wait':
        result = await client.wait(parseInt(args[1]) || 1000);
        break;
      case 'js':
        result = await client.executeJS(args.slice(1).join(' '));
        break;
      default:
        console.error('未知命令:', command);
        console.error('运行 "mcp --help" 查看帮助');
        process.exit(1);
    }
    
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('错误:', err.message);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

// 如果直接运行
if (require.main === module) {
  main();
}

module.exports = MCPClient;
