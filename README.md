# Firefox MCP (Model Context Protocol)

Firefox 浏览器自动化扩展，支持通过 MCP 协议远程控制浏览器。

## 功能特性

- 🔗 **远程控制** - 通过 WebSocket 连接控制 Firefox
- 🖱️ **鼠标操作** - 点击、滚动等操作
- ⌨️ **键盘输入** - 文本输入支持
- 📸 **截图** - 页面截图功能
- 🔄 **标签管理** - 获取标签列表、切换标签
- 📝 **内容提取** - 获取页面文本内容
- ⚡ **JavaScript 执行** - 在页面执行任意 JS

## 安装

### 1. 安装服务器

```bash
cd mcp-server
npm install
node ws-server-v2.js
```

服务器默认运行在 `ws://localhost:34567`

### 2. 安装 Firefox 扩展

**方法 A：直接安装签名版（推荐）**

| 版本 | 文件 | 日期 |
|------|------|------|
| **v1.0.1** | [firefox-mcp-v1.0.1.xpi](https://github.com/HougeLangley/firefox-mcp/releases/download/v1.0.1/firefox-mcp-v1.0.1.xpi) | 2026-04-22 |
| v1.0.0 | [firefox-mcp-v1.0.0.xpi](https://github.com/HougeLangley/firefox-mcp/releases/download/v1.0.0/firefox-mcp-v1.0.0.xpi) | 2026-04-16 |

1. 下载对应版本的 XPI 文件
2. 打开 Firefox，访问 `about:addons`
3. 点击齿轮图标 -> "从文件安装附加组件"
4. 选择下载的 XPI 文件

**方法 B：开发者模式（推荐开发使用）**
1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`
2. 点击"临时载入附加组件"
3. 选择 `extension/manifest.json`

**方法 B：打包安装**
1. 运行 `./package-extension.sh` 生成 XPI 文件
2. 在 Firefox 中安装 XPI 文件

### 3. 安装 CLI 工具

```bash
# 创建软链接
ln -s $(pwd)/bin/mcp ~/.local/bin/mcp

# 安装依赖
cd lib
npm install ws
```

## 使用方法

### CLI 命令

```bash
# 导航到 URL
mcp navigate https://example.com

# 向下滚动（默认 800px）
mcp scroll
mcp scroll 1000  # 滚动 1000px

# 向上滚动
mcp scrollup

# 点击坐标
mcp click 500 300

# 输入文本
mcp type "Hello World"

# 获取页面内容
mcp content

# 获取当前 URL
mcp url

# 获取页面标题
mcp title

# 截图
mcp screenshot

# 等待（毫秒）
mcp wait 2000

# 执行 JavaScript
mcp js "document.title"
```

### JavaScript API

```javascript
const MCPClient = require('./lib/mcp-client-fixed');

const client = new MCPClient();
await client.connect();

// 导航
await client.navigate('https://example.com');

// 滚动
await client.scrollDown(800);
await client.scrollUp(800);

// 点击
await client.click(500, 300);

// 输入
await client.type('Hello World');

// 执行 JS
await client.executeJS('document.title');

client.disconnect();
```

## 系统要求

- Firefox 91.0+
- Node.js 18+
- Linux/macOS/Windows

## 技术架构

```
┌─────────────┐      WebSocket       ┌──────────────┐
│   Client    │ ◄──────────────────► │ MCP Server   │
│  (Node.js)  │   ws://localhost:34567│  (Node.js)   │
└─────────────┘                      └──────┬───────┘
                                            │
                                            │ WebSocket
                                            │
                                      ┌─────┴──────┐
                                      │  Firefox   │
                                      │ Extension  │
                                      └────────────┘
```

## 可用工具

| 工具名 | 功能 |
|--------|------|
| `firefox_navigate` | 导航到 URL |
| `firefox_get_tabs` | 获取所有标签 |
| `firefox_get_current_url` | 获取当前 URL |
| `firefox_get_page_title` | 获取页面标题 |
| `firefox_get_page_content` | 获取页面内容 |
| `firefox_click` | 点击元素 |
| `firefox_type` | 输入文本 |
| `firefox_screenshot` | 截图 |
| `firefox_execute_js` | 执行 JavaScript |
| `firefox_wait` | 等待 |

## 配置

### 推荐方案：systemd + mcporter（OpenClaw 用户）

**架构**：
```
mcporter → stdio-bridge → WebSocket → Firefox Extension
                ↑
         systemd 服务保持运行
```

**1. 安装并启动 systemd 服务**

```bash
# 复制服务文件
cp mcp-server/firefox-mcp.service ~/.config/systemd/user/

# 启用并启动
systemctl --user daemon-reload
systemctl --user enable firefox-mcp
systemctl --user start firefox-mcp

# 验证状态
systemctl --user status firefox-mcp
curl http://localhost:34567/health
```

**2. 配置 mcporter**

编辑 `~/.mcporter/mcporter.json`：

```json
{
  "mcpServers": {
    "firefox-mcp": {
      "command": "node",
      "args": ["/path/to/firefox-mcp/mcp-server/stdio-bridge-v2.js"]
    }
  }
}
```

**3. 使用 mcporter 调用**

```bash
# 列出工具
mcporter list firefox-mcp

# 导航到网页
mcporter call firefox-mcp.firefox_navigate url="https://example.com"

# 滚动页面
mcporter call firefox-mcp.firefox_execute_js code="window.scrollBy(0, 800)"
```

📖 **详细指南**: [MCPorter-Guide.md](./MCPorter-Guide.md)

### 替代方案：手动启动服务器

如果不使用 systemd，可以手动启动服务器：

```bash
cd mcp-server
npm install
node ws-server-v2.js
```

然后配置 mcporter 同上。注意：手动启动的服务器在终端关闭后会停止。

## 开发

### 构建扩展

```bash
./package-extension.sh
```

### 运行测试

```bash
node test-connection.js
```

## 更新日志

### v1.0.1 (2026-04-22)
- **修复 navigate**: `browser.tabs.update()` 返回旧 URL → 改用 `tabs.onUpdated` 监听页面加载完成
- **修复 execute_js**: `executeScript requires code or file` → 用 IIFE 包装代码
- **修复 click/type**: `redeclaration of const el` → 所有 `executeScript` 代码字符串用 IIFE 隔离作用域

### v1.0.0 (2026-04-16)
- 初始版本，支持 10 个 MCP 工具
- 支持 WebSocket 连接、标签管理、截图、JS 执行等

## 许可证

MIT License - 详见 LICENSE 文件

## 作者

- 墨 (Mo) - OpenClaw 项目

## 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Mozilla Add-ons](https://addons.mozilla.org/)

## 🔌 mcporter 集成（OpenClaw 用户推荐）

Firefox MCP 支持通过 [mcporter](https://github.com/openclaw/mcporter) 调用，方便 OpenClaw 用户使用。

📖 **详细指南**: [MCPorter-Guide.md](./MCPorter-Guide.md) - 包含完整的安装、配置和使用教程

### 配置

添加到你的 `~/.mcporter/mcporter.json`:

```json
{
  "mcpServers": {
    "firefox-mcp": {
      "command": "node",
      "args": ["/path/to/firefox-mcp/mcp-server/stdio-bridge-v2.js"]
    }
  }
}
```

### 使用 mcporter 调用

```bash
# 列出工具
mcporter list firefox-mcp

# 导航到 URL
mcporter call firefox-mcp.firefox_navigate url="https://example.com"

# 获取当前页面信息
mcporter call firefox-mcp.firefox_get_current_url
mcporter call firefox-mcp.firefox_get_page_title
mcporter call firefox-mcp.firefox_get_page_content

# 执行 JavaScript
mcporter call firefox-mcp.firefox_execute_js code="window.scrollBy(0, 800)"

# 截图
mcporter call firefox-mcp.firefox_screenshot

# 等待
mcporter call firefox-mcp.firefox_wait duration=2000
```

### 前提条件

- Firefox MCP 服务器必须正在运行（`systemctl --user status firefox-mcp`）
- Firefox 扩展必须已安装并连接
