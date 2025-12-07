#!/bin/bash

# Peinture 一键部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e

echo "=========================================="
echo "  Peinture AI 图片生成器 - 部署脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}建议使用 root 用户运行此脚本${NC}"
fi

# 检查 Node.js
echo -e "\n${GREEN}[1/6] 检查 Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js 未安装，正在安装...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node.js 版本: $(node -v)"

# 检查 PM2
echo -e "\n${GREEN}[2/6] 检查 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    sudo npm install -g pm2
fi
echo "PM2 已安装"

# 安装依赖
echo -e "\n${GREEN}[3/6] 安装项目依赖...${NC}"
npm install

# 构建前端
echo -e "\n${GREEN}[4/6] 构建前端...${NC}"
npm run build

# 创建必要目录
echo -e "\n${GREEN}[5/6] 创建目录...${NC}"
mkdir -p data logs
chmod 755 data logs

# 启动/重启服务
echo -e "\n${GREEN}[6/6] 启动服务...${NC}"
if pm2 describe peinture-api > /dev/null 2>&1; then
    echo "重启 API 服务..."
    pm2 restart peinture-api
else
    echo "启动 API 服务..."
    pm2 start ecosystem.config.cjs
fi

# 保存 PM2 配置
pm2 save

echo -e "\n=========================================="
echo -e "${GREEN}部署完成!${NC}"
echo "=========================================="
echo ""
echo "API 服务: http://localhost:3001"
echo "健康检查: curl http://localhost:3001/api/health"
echo ""
echo "下一步:"
echo "1. 配置 Nginx 反向代理 (参考 nginx.conf.example)"
echo "2. 添加 Hugging Face Token:"
echo "   curl -X POST http://localhost:3001/api/tokens \\"
echo "     -H 'X-Admin-Password: affadsense' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"token\": \"hf_xxxxx\", \"name\": \"My Token\"}'"
echo ""
echo "查看日志: pm2 logs peinture-api"
echo "查看状态: pm2 status"
