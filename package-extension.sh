#!/bin/bash
# 打包 Firefox MCP 扩展为 XPI 文件

EXTENSION_DIR="$HOME/.openclaw/firefox-mcp/extension"
OUTPUT_DIR="$HOME/.openclaw/firefox-mcp"
VERSION=$(grep '"version"' "$EXTENSION_DIR/manifest.json" | cut -d'"' -f4)

# 创建 XPI 文件 (ZIP 格式)
cd "$EXTENSION_DIR"
zip -r "$OUTPUT_DIR/firefox-mcp-v$VERSION.xpi" . -x "*.git*" -x "*node_modules*"

echo "Extension packaged: $OUTPUT_DIR/firefox-mcp-v$VERSION.xpi"
echo ""
echo "安装方法:"
echo "1. 打开 Firefox"
echo "2. 地址栏输入: about:addons"
echo "3. 点击齿轮图标 -> 从文件安装附加组件"
echo "4. 选择: $OUTPUT_DIR/firefox-mcp-v$VERSION.xpi"
