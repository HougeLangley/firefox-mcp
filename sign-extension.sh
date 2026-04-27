#!/bin/bash
# 签名 Firefox MCP 扩展

echo "=== Firefox MCP 扩展签名工具 ==="
echo ""
echo "签名需要 Mozilla Add-ons API 密钥。"
echo ""
echo "步骤："
echo ""
echo "1. 访问 Mozilla 开发者网站："
echo "   https://addons.mozilla.org/en-US/developers/addon/api/key/"
echo ""
echo "2. 登录你的 Firefox 账号"
echo "3. 生成新的 API 密钥（记下 JWT issuer 和 JWT secret）"
echo ""
echo "4. 运行以下命令签名："
echo ""
echo "   web-ext sign \\"
echo "     --source-dir=~/.openclaw/firefox-mcp/extension \\"
echo "     --artifacts-dir=~/.openclaw/firefox-mcp/signed \\"
echo "     --api-key=YOUR_JWT_ISSUER \\"
echo "     --api-secret=YOUR_JWT_SECRET \\"
echo "     --channel=unlisted"
echo ""
echo "5. 签名后的扩展将保存在："
echo "   ~/.openclaw/firefox-mcp/signed/"
echo ""
echo "注意："
echo "- 使用 --channel=unlisted 表示这是未列出的扩展（不公开）"
echo "- 签名后的扩展可以永久安装，不会过期"
echo "- 每次更新扩展都需要重新签名"
echo ""

# 检查 web-ext
if ! command -v web-ext &> /dev/null; then
    echo "错误：web-ext 未安装"
    echo "请运行：npm install -g web-ext"
    exit 1
fi

echo "web-ext 版本：$(web-ext --version)"
echo ""

# 检查扩展目录
if [ ! -d "$HOME/.openclaw/firefox-mcp/extension" ]; then
    echo "错误：扩展目录不存在"
    exit 1
fi

echo "扩展目录：$HOME/.openclaw/firefox-mcp/extension"
echo ""

# 提示用户输入 API 密钥
read -p "请输入 JWT issuer (API key): " API_KEY
read -p "请输入 JWT secret: " API_SECRET

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    echo "错误：API 密钥不能为空"
    exit 1
fi

# 创建输出目录
mkdir -p "$HOME/.openclaw/firefox-mcp/signed"

# 签名扩展
echo ""
echo "正在签名扩展..."
web-ext sign \
    --source-dir="$HOME/.openclaw/firefox-mcp/extension" \
    --artifacts-dir="$HOME/.openclaw/firefox-mcp/signed" \
    --api-key="$API_KEY" \
    --api-secret="$API_SECRET" \
    --channel=unlisted

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 签名成功！"
    echo ""
    echo "签名后的扩展："
    ls -lh "$HOME/.openclaw/firefox-mcp/signed/"*.xpi
    echo ""
    echo "安装方法："
    echo "1. 打开 Firefox"
    echo "2. 地址栏输入：about:addons"
    echo "3. 齿轮图标 → 从文件安装附加组件"
    echo "4. 选择签名后的 XPI 文件"
else
    echo ""
    echo "❌ 签名失败"
    echo "请检查 API 密钥是否正确"
fi
