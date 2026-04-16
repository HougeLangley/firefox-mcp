# OpenClaw + mcporter + Firefox MCP 使用指南

本指南介绍如何在 OpenClaw 环境中使用 mcporter 调用 Firefox MCP 进行浏览器自动化。

## 前置条件

- OpenClaw 已安装并运行
- mcporter 已安装（OpenClaw 默认包含）
- Firefox 浏览器
- Node.js 18+

## 安装步骤

### 1. 安装 Firefox MCP 服务器

```bash
# 克隆仓库
git clone https://github.com/HougeLangley/firefox-mcp.git
cd firefox-mcp

# 安装服务器依赖
cd mcp-server
npm install
cd ..

# 安装 CLI 工具依赖
cd lib
npm install ws
cd ..
```

### 2. 安装 Firefox 扩展

**方式 A：直接安装签名版（推荐）**
1. 下载 [firefox-mcp-v1.0.0.xpi](https://github.com/HougeLangley/firefox-mcp/releases/download/v1.0.0/firefox-mcp-v1.0.0.xpi)
2. 打开 Firefox，访问 `about:addons`
3. 点击齿轮图标 → "从文件安装附加组件"
4. 选择下载的 XPI 文件

**方式 B：开发者模式**
1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`
2. 点击"临时载入附加组件"
3. 选择 `extension/manifest.json`

### 3. 启动 MCP 服务器

mcporter 会自动管理服务器，无需手动启动。当你调用 `mcporter list firefox-mcp` 或 `mcporter call firefox-mcp.xxx` 时，mcporter 会自动启动服务器。

**验证服务器状态**：

```bash
# 检查服务器是否响应
curl http://localhost:34567/health

# 应返回：{"status":"ok","firefoxConnected":true}
```

**手动启动（调试时使用）**：

```bash
node mcp-server/ws-server-v2.js
```

### 4. 配置 mcporter

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

将 `/path/to/firefox-mcp` 替换为实际路径。

### 5. 验证安装

```bash
# 检查服务器状态
curl http://localhost:34567/health

# 应该返回：{"status":"ok","firefoxConnected":true}

# 列出 Firefox MCP 工具
mcporter list firefox-mcp
```

## 使用示例

### 基本操作

```bash
# 导航到网页
mcporter call firefox-mcp.firefox_navigate url="https://www.phoronix.com"

# 获取当前 URL
mcporter call firefox-mcp.firefox_get_current_url

# 获取页面标题
mcporter call firefox-mcp.firefox_get_page_title

# 获取页面内容
mcporter call firefox-mcp.firefox_get_page_content
```

### 滚动页面

```bash
# 向下滚动 800px
mcporter call firefox-mcp.firefox_execute_js code="window.scrollBy(0, 800)"

# 向上滚动 800px
mcporter call firefox-mcp.firefox_execute_js code="window.scrollBy(0, -800)"

# 滚动到页面底部
mcporter call firefox-mcp.firefox_execute_js code="window.scrollTo(0, document.body.scrollHeight)"

# 滚动到页面顶部
mcporter call firefox-mcp.firefox_execute_js code="window.scrollTo(0, 0)"
```

### 点击和输入

```bash
# 点击元素（通过 CSS 选择器）
mcporter call firefox-mcp.firefox_click selector="button.submit"

# 在输入框输入文本
mcporter call firefox-mcp.firefox_type selector="input#search" text="Linux kernel"

# 输入并提交
mcporter call firefox-mcp.firefox_type selector="input#search" text="Linux kernel" submit=true
```

### 执行 JavaScript

```bash
# 获取页面信息
mcporter call firefox-mcp.firefox_execute_js code="document.title"

# 获取所有链接
mcporter call firefox-mcp.firefox_execute_js code="Array.from(document.links).map(l => l.href).slice(0, 10)"

# 获取页面文本内容
mcporter call firefox-mcp.firefox_execute_js code="document.body.innerText.slice(0, 1000)"

# 修改页面样式
mcporter call firefox-mcp.firefox_execute_js code="document.body.style.backgroundColor = 'yellow'"
```

### 截图

```bash
# 截取可见区域
mcporter call firefox-mcp.firefox_screenshot

# 截取完整页面
mcporter call firefox-mcp.firefox_screenshot fullPage=true
```

### 标签管理

```bash
# 获取所有标签
mcporter call firefox-mcp.firefox_get_tabs

# 导航到新标签
mcporter call firefox-mcp.firefox_navigate url="https://github.com"
```

### 等待

```bash
# 等待 2 秒
mcporter call firefox-mcp.firefox_wait duration=2000

# 等待页面加载完成
mcporter call firefox-mcp.firefox_execute_js code="await new Promise(r => setTimeout(r, 3000)); 'waited'"
```

## 完整工作流示例

### 示例 1：获取文章完整内容

```bash
#!/bin/bash

# 导航到文章
mcporter call firefox-mcp.firefox_navigate url="https://www.phoronix.com/news/Intel-LASS-Linux-7.1"

# 等待页面加载
mcporter call firefox-mcp.firefox_wait duration=3000

# 获取标题
echo "=== 标题 ==="
mcporter call firefox-mcp.firefox_get_page_title

# 获取内容
echo "=== 内容 ==="
mcporter call firefox-mcp.firefox_get_page_content

# 向下滚动查看更多内容
for i in {1..3}; do
    mcporter call firefox-mcp.firefox_execute_js code="window.scrollBy(0, 800)"
    mcporter call firefox-mcp.firefox_wait duration=1000
done

# 再次获取内容（包含滚动后的内容）
echo "=== 完整内容 ==="
mcporter call firefox-mcp.firefox_get_page_content
```

### 示例 2：自动化表单填写

```bash
#!/bin/bash

# 导航到表单页面
mcporter call firefox-mcp.firefox_navigate url="https://example.com/form"

# 等待页面加载
mcporter call firefox-mcp.firefox_wait duration=2000

# 填写表单
mcporter call firefox-mcp.firefox_type selector="input[name='username']" text="myuser"
mcporter call firefox-mcp.firefox_type selector="input[name='password']" text="mypass"

# 点击提交
mcporter call firefox-mcp.firefox_click selector="button[type='submit']"

# 等待结果
mcporter call firefox-mcp.firefox_wait duration=3000

# 获取结果页面标题
mcporter call firefox-mcp.firefox_get_page_title
```

### 示例 3：批量截图

```bash
#!/bin/bash

urls=(
    "https://www.phoronix.com"
    "https://github.com"
    "https://openclaw.ai"
)

for url in "${urls[@]}"; do
    echo "Screenshot: $url"
    mcporter call firefox-mcp.firefox_navigate url="$url"
    mcporter call firefox-mcp.firefox_wait duration=3000
    mcporter call firefox-mcp.firefox_screenshot fullPage=true
    sleep 2
done
```

## 故障排除

### 问题 1："WebSocket not connected"

**原因**：Firefox MCP 服务器未运行或 Firefox 扩展未连接。

**解决**：
```bash
# 检查服务器状态
systemctl --user status firefox-mcp

# 如果未运行，启动它
systemctl --user start firefox-mcp

# 检查 Firefox 扩展是否已安装并启用
# 访问 about:addons 确认扩展状态
```

### 问题 2："Connection refused"

**原因**：端口 34567 被占用或服务器未启动。

**解决**：
```bash
# 检查端口占用
lsof -i :34567

# 重启服务器
systemctl --user restart firefox-mcp
```

### 问题 3：工具调用无响应

**原因**：mcporter 配置错误或桥接器脚本路径错误。

**解决**：
```bash
# 检查配置文件路径
cat ~/.mcporter/mcporter.json

# 验证脚本存在
ls -la /path/to/firefox-mcp/mcp-server/stdio-bridge-v2.js

# 测试直接调用
node /path/to/firefox-mcp/mcp-server/stdio-bridge-v2.js
```

### 问题 4：Firefox 扩展显示"未连接"

**原因**：服务器未运行或扩展未正确安装。

**解决**：
1. 确保服务器正在运行
2. 刷新 Firefox 页面
3. 点击扩展图标查看状态
4. 重新安装扩展

## 高级用法

### 与 OpenClaw 集成

在 OpenClaw 中，你可以直接调用 mcporter：

```javascript
// OpenClaw 可以执行 shell 命令
const result = await exec(`mcporter call firefox-mcp.firefox_get_page_title`);
console.log(result);
```

### 创建自定义脚本

创建 `~/.local/bin/firefox-mcp-helper`：

```bash
#!/bin/bash
# Firefox MCP 快捷命令

case "$1" in
    nav)
        mcporter call firefox-mcp.firefox_navigate url="$2"
        ;;
    scroll)
        mcporter call firefox-mcp.firefox_execute_js code="window.scrollBy(0, ${2:-800})"
        ;;
    title)
        mcporter call firefox-mcp.firefox_get_page_title
        ;;
    url)
        mcporter call firefox-mcp.firefox_get_current_url
        ;;
    *)
        echo "Usage: firefox-mcp-helper [nav|scroll|title|url] [args]"
        ;;
esac
```

然后使用：
```bash
firefox-mcp-helper nav https://example.com
firefox-mcp-helper scroll 1000
firefox-mcp-helper title
```

## 安全注意事项

1. **不要在公共网络暴露 MCP 服务器** - 默认只监听 localhost
2. **小心执行 JavaScript** - 避免执行不受信任的代码
3. **注意隐私** - 自动化操作可能访问敏感页面

## 获取帮助

- GitHub Issues: https://github.com/HougeLangley/firefox-mcp/issues
- OpenClaw 社区: https://discord.com/invite/clawd
- 文档: https://github.com/HougeLangley/firefox-mcp/blob/main/README.md

## 许可证

MIT License - 详见 [LICENSE](https://github.com/HougeLangley/firefox-mcp/blob/main/LICENSE)
