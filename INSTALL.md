# Firefox MCP 安装指南

## 快速开始（OpenClaw 用户推荐）

如果你使用 OpenClaw，推荐通过 mcporter 使用 Firefox MCP：

```bash
# 1. 克隆仓库
git clone https://github.com/HougeLangley/firefox-mcp.git
cd firefox-mcp

# 2. 安装依赖
cd mcp-server && npm install && cd ..
cd lib && npm install ws && cd ..

# 3. 配置 mcporter
cat >> ~/.mcporter/mcporter.json << 'EOF'
{
  "mcpServers": {
    "firefox-mcp": {
      "command": "node",
      "args": ["$(pwd)/mcp-server/stdio-bridge-v2.js"]
    }
  }
}
EOF

# 4. 安装 Firefox 扩展
# 下载 firefox-mcp-v1.0.0.xpi 并安装到 Firefox

# 5. 开始使用
mcporter list firefox-mcp
mcporter call firefox-mcp.firefox_navigate url="https://example.com"
```

📖 **详细指南**: [MCPorter-Guide.md](./MCPorter-Guide.md)

---

## 标准安装

### 1. 安装 Firefox 扩展

**方法 A：直接安装签名版（推荐）**

1. 下载 [firefox-mcp-v1.0.0.xpi](https://github.com/HougeLangley/firefox-mcp/releases/download/v1.0.0/firefox-mcp-v1.0.0.xpi)
2. 打开 Firefox，访问 `about:addons`
3. 点击齿轮图标 → "从文件安装附加组件"
4. 选择下载的 XPI 文件

**方法 B：开发者模式（开发使用）**

1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`
2. 点击"临时载入附加组件"
3. 选择 `extension/manifest.json`

### 2. 启动 MCP 服务器（systemd 推荐）

**方式 1：使用 systemd（推荐，生产环境）**

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

**方式 2：手动启动（开发调试）**

```bash
cd mcp-server
npm install
node ws-server-v2.js
```

注意：手动启动的服务器在关闭终端后会停止。

### 3. 验证安装

```bash
# 检查服务器状态
curl http://localhost:34567/health
# 应返回：{"status":"ok","firefoxConnected":true}

# 测试 mcporter
mcporter list firefox-mcp
```

## 使用方法

### 使用 mcporter（推荐）

```bash
# 导航
mcporter call firefox-mcp.firefox_navigate url="https://phoronix.com"

# 获取信息
mcporter call firefox-mcp.firefox_get_page_title
mcporter call firefox-mcp.firefox_get_page_content

# 滚动
mcporter call firefox-mcp.firefox_execute_js code="window.scrollBy(0, 800)"

# 截图
mcporter call firefox-mcp.firefox_screenshot
```

### 使用 CLI 工具

```bash
# 导航
./bin/mcp navigate https://example.com

# 滚动
./bin/mcp scroll

# 获取内容
./bin/mcp content
```

### 使用 JavaScript API

```javascript
const MCPClient = require('./lib/mcp-client-fixed');
const client = new MCPClient();

await client.connect();
await client.navigate('https://example.com');
await client.scrollDown(800);
console.log(await client.getTitle());
client.disconnect();
```

## 故障排除

### 扩展无法连接
1. 检查 MCP 服务器是否运行：`curl http://localhost:34567/health`
2. 重新点击扩展图标，点击"Reconnect"
3. 检查 Firefox 控制台（F12 → 控制台）

### mcporter 无法调用
1. 检查配置文件路径：`cat ~/.mcporter/mcporter.json`
2. 验证脚本存在：`ls -la mcp-server/stdio-bridge-v2.js`
3. 检查服务器状态：`curl http://localhost:34567/health`

### 权限问题
如果安装时提示权限不足：
1. 在 `about:config` 中设置 `xpinstall.signatures.required` 为 `false`
2. 或使用开发者模式安装

## 更新

```bash
git pull origin main
# 重新安装扩展（如果更新了扩展代码）
```

## 获取帮助

- GitHub Issues: https://github.com/HougeLangley/firefox-mcp/issues
- OpenClaw 社区: https://discord.com/invite/clawd
