# Firefox MCP 扩展安装指南

## 安装包位置
`~/.openclaw/firefox-mcp/firefox-mcp-v1.0.0.xpi`

## 安装步骤

### 方法一：从文件安装（推荐）

1. **打开 Firefox**
2. **访问扩展管理页面**
   - 地址栏输入：`about:addons`
   - 或点击菜单 → 扩展和主题

3. **安装扩展**
   - 点击齿轮图标（⚙️）
   - 选择"从文件安装附加组件..."
   - 选择：`~/.openclaw/firefox-mcp/firefox-mcp-v1.0.0.xpi`
   - 点击"添加”确认安装

4. **连接 MCP 服务器**
   - 点击工具栏上的 MCP 扩展图标
   - 点击"Connect"按钮
   - 状态应显示为"Connected"

### 方法二：开发者模式安装

1. **打开 Firefox**
2. **访问调试页面**
   - 地址栏输入：`about:debugging#/runtime/this-firefox`

3. **加载扩展**
   - 点击"临时载入附加组件"
   - 选择：`~/.openclaw/firefox-mcp/extension/manifest.json`

4. **注意**：此方法每次重启 Firefox 后需要重新加载

## 验证安装

安装完成后，运行以下命令测试：

```bash
# 检查 MCP 服务器状态
curl http://localhost:34567/health

# 应该返回：
# {"status":"ok","firefoxConnected":true}
```

## 使用方法

### 1. CLI 工具

```bash
# 导航到指定 URL
~/.openclaw/firefox-mcp/bin/ff-navigate https://phoronix.com

# 获取页面内容
~/.openclaw/firefox-mcp/bin/ff-content

# 点击元素
~/.openclaw/firefox-mcp/bin/ff-click 100 200

# 输入文本
~/.openclaw/firefox-mcp/bin/ff-type "Hello World"

# 截图
~/.openclaw/firefox-mcp/bin/ff-screenshot
```

### 2. HTTP API

```bash
# 导航
curl "http://localhost:34567/navigate?url=https://phoronix.com"

# 获取内容
curl http://localhost:34567/content

# 点击
curl "http://localhost:34567/click?x=100&y=200"

# 输入
curl -X POST "http://localhost:34567/type" -d "text=Hello"
```

## 自动启动 MCP 服务器

创建 systemd 用户服务：

```bash
# 创建服务文件
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/firefox-mcp.service << 'EOF'
[Unit]
Description=Firefox MCP Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node %h/.openclaw/firefox-mcp/mcp-server/ws-server-v2.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

# 启用并启动服务
systemctl --user daemon-reload
systemctl --user enable firefox-mcp.service
systemctl --user start firefox-mcp.service
```

## 故障排除

### 扩展无法连接
1. 检查 MCP 服务器是否运行：`curl http://localhost:34567/health`
2. 重新点击扩展图标，点击"Reconnect"
3. 检查 Firefox 控制台是否有错误（F12 → 控制台）

### 权限问题
如果安装时提示权限不足，尝试：
1. 在 `about:config` 中设置 `xpinstall.signatures.required` 为 `false`
2. 或使用开发者模式安装

## 更新扩展

重新运行打包脚本：
```bash
~/.openclaw/firefox-mcp/package-extension.sh
```

然后在 Firefox 中重新安装新版本。
