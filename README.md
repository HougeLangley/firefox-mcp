# Firefox MCP 使用指南

> **更新日期**: 2026-04-25
> **版本**: v1.0.6
> **控制方式**: WebSocket + MCP 协议（已弃用 mcporter）

---

## 概述

Firefox MCP (Model Context Protocol) 是一个浏览器自动化扩展，允许 AI 通过 WebSocket 直接控制 Firefox 浏览器。

## 架构

```
Python 脚本 ←→ WebSocket /client ←→ MCP Server (34567) ←→ WebSocket /firefox ←→ Firefox
```

## 安装状态

- ✅ 扩展已签名并安装 (v1.0.6)
- ✅ MCP 服务器运行中 (端口 34567)
- ✅ WebSocket 连接可用
- ✅ 开机自启已配置

---

## 快速开始

### 1. 确保 Firefox 扩展已连接

1. 打开 Firefox
2. 点击工具栏上的 MCP 图标
3. 确认显示 "Connected"

### 2. 使用 Python 直接控制

```python
import asyncio
import websockets
import json
import base64

async def control_firefox():
    # 连接到 MCP Server
    uri = 'ws://127.0.0.1:34567/client'
    
    # 注意：需要增加消息大小限制（截图数据大）
    async with websockets.connect(uri, max_size=10*1024*1024) as ws:
        # 初始化 MCP
        await ws.send(json.dumps({
            'jsonrpc': '2.0',
            'id': '1',
            'method': 'initialize',
            'params': {
                'protocolVersion': '2024-11-05',
                'capabilities': {},
                'clientInfo': {'name': 'my-app', 'version': '1.0'}
            }
        }))
        await ws.recv()
        
        # 导航到网站
        await ws.send(json.dumps({
            'jsonrpc': '2.0',
            'id': '2',
            'method': 'tools/call',
            'params': {
                'name': 'firefox_navigate',
                'arguments': {'url': 'https://example.com'}
            }
        }))
        await ws.recv()
        
        # 获取页面标题
        await ws.send(json.dumps({
            'jsonrpc': '2.0',
            'id': '3',
            'method': 'tools/call',
            'params': {
                'name': 'firefox_get_page_title',
                'arguments': {}
            }
        }))
        resp = await ws.recv()
        data = json.loads(resp)
        result = json.loads(data['result']['content'][0]['text'])
        print(f"标题: {result.get('title')}")
        
        # 截图
        await ws.send(json.dumps({
            'jsonrpc': '2.0',
            'id': '4',
            'method': 'tools/call',
            'params': {
                'name': 'firefox_screenshot',
                'arguments': {}
            }
        }))
        resp = await ws.recv()
        data = json.loads(resp)
        result = json.loads(data['result']['content'][0]['text'])
        
        # 处理 base64 前缀（重要！）
        screenshot_data = result['screenshot']
        if ',' in screenshot_data:
            screenshot_data = screenshot_data.split(',')[1]
        
        png_data = base64.b64decode(screenshot_data)
        with open('screenshot.png', 'wb') as f:
            f.write(png_data)
        print("截图已保存")

asyncio.run(control_firefox())
```

---

## 可用工具（19个）

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `firefox_navigate` | `{"url": "..."}` | 导航到 URL |
| `firefox_get_tabs` | `{}` | 获取所有标签页 |
| `firefox_get_current_url` | `{}` | 获取当前 URL |
| `firefox_get_page_title` | `{}` | 获取页面标题 |
| `firefox_get_page_content` | `{}` | 获取页面内容 |
| `firefox_click` | `{"selector": "..."}` | 点击元素 |
| `firefox_type` | `{"selector": "...", "text": "..."}` | 输入文本 |
| `firefox_scroll` | `{"direction": "down", "pixels": 500}` | 滚动页面 |
| `firefox_press_key` | `{"key": "Enter"}` | 按键 |
| `firefox_select` | `{"selector": "...", "value": "..."}` | 选择下拉选项 |
| `firefox_clear` | `{"selector": "..."}` | 清空输入 |
| `firefox_hover` | `{"selector": "..."}` | 悬停元素 |
| `firefox_refresh` | `{}` | 刷新页面 |
| `firefox_go_back` | `{}` | 后退 |
| `firefox_go_forward` | `{}` | 前进 |
| `firefox_screenshot` | `{}` | 截图（返回 base64） |
| `firefox_execute_js` | `{"code": "..."}` | 执行 JavaScript |
| `firefox_wait` | `{"duration": 2}` | 等待（秒） |

---

## 关键注意事项

### 1. WebSocket 消息大小限制
截图数据约 1.5MB，必须设置 `max_size=10*1024*1024`：
```python
async with websockets.connect(uri, max_size=10*1024*1024) as ws:
```

### 2. Base64 前缀处理
截图数据包含 `data:image/png;base64,` 前缀，需要分割：
```python
screenshot_data = result['screenshot']
if ',' in screenshot_data:
    screenshot_data = screenshot_data.split(',')[1]
png_data = base64.b64decode(screenshot_data)
```

### 3. Selector 引号
使用单引号包裹 selector：
```python
'input[name="custname"]'
```

### 4. 手动连接
Firefox 扩展需要用户手动点击连接按钮，无法自动连接。

---

## 服务管理

```bash
# 查看状态
systemctl --user status firefox-mcp

# 重启服务
systemctl --user restart firefox-mcp

# 停止服务
systemctl --user stop firefox-mcp

# 禁用开机自启
systemctl --user disable firefox-mcp
```

---

## 故障排除

### 扩展未连接
1. 检查 Firefox 扩展是否启用
2. 点击 MCP 图标，点击 "Connect"
3. 重启服务：`systemctl --user restart firefox-mcp`

### 命令无响应
1. 检查服务状态：`systemctl --user status firefox-mcp`
2. 检查 Health：`curl http://127.0.0.1:34567/health`
3. 重启服务

### 截图失败
1. 检查是否设置 `max_size=10*1024*1024`
2. 检查 Base64 前缀处理
3. 尝试减少截图区域

---

## 与 mcporter 的区别

| 特性 | mcporter (旧) | WebSocket (新) |
|------|---------------|----------------|
| 控制方式 | CLI 命令 | Python 直接连接 |
| 灵活性 | 低 | 高 |
| 集成度 | 需外部调用 | 直接集成到代码 |
| 依赖 | mcporter 工具 | 仅需 websockets 库 |

**建议**: 新项目使用 WebSocket 方式，旧项目可逐步迁移。

---

## 文件位置

- 扩展源码：`~/.openclaw/firefox-mcp/extension/`
- MCP 服务器：`~/.openclaw/firefox-mcp/mcp-server/`
- Native Host：`~/.openclaw/firefox-mcp/native-host/`
- 签名扩展：`~/.openclaw/firefox-mcp/signed/`
- 服务配置：`~/.config/systemd/user/firefox-mcp.service`

---

## 更新日志

### v1.0.6 (2026-04-25)
- 修复 click、type、press_key、select、clear、hover 的 IIFE 参数传递
- 更新文档为 WebSocket 控制方式
- 弃用 mcporter CLI 工具

### v1.0.4 (2026-04-22)
- 初始发布
- 支持 mcporter 控制

---

*最后更新: 2026-04-25*
