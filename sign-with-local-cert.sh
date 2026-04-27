#!/bin/bash
# 使用本地证书签名 Firefox 扩展

echo "=== 使用本地证书签名 Firefox MCP 扩展 ==="
echo ""
echo "注意：Firefox 默认不信任自签名证书"
echo "安装时需要在 about:config 中设置："
echo "  xpinstall.signatures.required = false"
echo ""

EXT_DIR="$HOME/.openclaw/firefox-mcp/extension"
OUTPUT_DIR="$HOME/.openclaw/firefox-mcp/signed"
CERT_DIR="$HOME/.openclaw/firefox-mcp/certs"
VERSION=$(grep '"version"' "$EXT_DIR/manifest.json" | cut -d'"' -f4)

mkdir -p "$OUTPUT_DIR"

# 方法1：使用 web-ext 构建未签名扩展（用于开发者模式加载）
echo "方法1：构建未签名扩展（推荐用于开发者模式）"
web-ext build \
    --source-dir="$EXT_DIR" \
    --artifacts-dir="$OUTPUT_DIR" \
    --overwrite-dest

if [ $? -eq 0 ]; then
    echo "✅ 未签名扩展已构建"
    echo "位置：$OUTPUT_DIR/firefox_mcp-$VERSION.zip"
    echo ""
    echo "使用方法："
    echo "1. 重命名为 .xpi：mv $OUTPUT_DIR/firefox_mcp-$VERSION.zip $OUTPUT_DIR/firefox-mcp-unsigned.xpi"
    echo "2. 在 Firefox about:config 中设置 xpinstall.signatures.required = false"
    echo "3. 拖放 .xpi 文件到 Firefox 窗口安装"
else
    echo "❌ 构建失败"
fi

echo ""
echo "方法2：使用 Mozilla 官方签名（推荐用于永久安装）"
echo "运行：~/.openclaw/firefox-mcp/sign-extension.sh"
