# MCP Server 文档

## 概述

MCP Server 是 Firefox MCP 的核心组件，提供 WebSocket 服务，允许客户端通过 MCP 协议控制 Firefox 浏览器。

## 架构

```
客户端 (Python/Node.js) ←→ WebSocket /client ←→ MCP Server ←→ WebSocket /firefox ←→ Firefox Extension
```

## 安装

```bash
cd mcp-server
npm install
```

## 启动

```bash
# 使用 ws-server-v2.js (推荐)
node mcp-server/ws-server-v2.js

# 或使用 stdio-bridge-v2.js
node mcp-server/stdio-bridge-v2.js
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `34567` | WebSocket 端口 |

### Systemd 服务

```bash
# 复制服务文件
cp mcp-server/firefox-mcp.service ~/.config/systemd/user/

# 启用并启动
systemctl --user enable firefox-mcp
systemctl --user start firefox-mcp
```

## API

### WebSocket 端点

| 端点 | 用途 |
|------|------|
| `ws://localhost:34567/client` | 客户端连接（发送命令） |
| `ws://localhost:34567/firefox` | Firefox 扩展连接 |

### HTTP 端点

| 端点 | 用途 |
|------|------|
| `http://localhost:34567/health` | 健康检查 |

### MCP 协议

#### 初始化
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "my-app", "version": "1.0"}
  }
}
```

#### 调用工具
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": {
    "name": "firefox_navigate",
    "arguments": {"url": "https://example.com"}
  }
}
```

#### 获取工具列表
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/list",
  "params": {}
}
```

## 可用工具

详见主 README.md 中的工具列表。

## 开发

### 文件说明

| 文件 | 说明 |
|------|------|
| `ws-server-v2.js` | WebSocket 服务器（推荐） |
| `ws-server.js` | 旧版 WebSocket 服务器 |
| `stdio-bridge-v2.js` | STDIO 桥接（用于 mcporter） |
| `server.js` | 主服务器入口 |
| `http-server.js` | HTTP 服务器 |

### 调试

```bash
# 查看日志
journalctl --user -u firefox-mcp -f

# 测试连接
curl http://localhost:34567/health
```

## 贡献

欢迎提交 Issue 和 PR！

---

*最后更新: 2026-04-25*
