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

**方法 A：开发者模式（推荐开发使用）**
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

### 系统服务（systemd）

```bash
# 复制服务文件
cp mcp-server/firefox-mcp.service ~/.config/systemd/user/

# 启用并启动
systemctl --user enable firefox-mcp
systemctl --user start firefox-mcp
```

## 开发

### 构建扩展

```bash
./package-extension.sh
```

### 运行测试

```bash
node test-connection.js
```

## 许可证

MIT License - 详见 LICENSE 文件

## 作者

- 墨 (Mo) - OpenClaw 项目

## 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Mozilla Add-ons](https://addons.mozilla.org/)
