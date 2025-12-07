#!/bin/bash

# Peinture 快速启动脚本
# 使用方法: chmod +x start.sh && ./start.sh

# 默认端口 1997，可通过参数修改
PORT=${1:-1997}
IMAGE="ghcr.io/YOUR_USERNAME/peinture:latest"

echo "=========================================="
echo "  Peinture AI 图片生成器"
echo "=========================================="
echo ""

# 创建数据目录
mkdir -p data logs

# 拉取最新镜像
echo "拉取最新镜像..."
docker pull $IMAGE

# 停止旧容器
docker stop peinture 2>/dev/null
docker rm peinture 2>/dev/null

# 启动新容器
echo "启动容器 (端口: $PORT)..."
docker run -d \
  --name peinture \
  --restart unless-stopped \
  -p $PORT:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  $IMAGE

echo ""
echo "=========================================="
echo "启动成功!"
echo "=========================================="
echo ""
echo "访问地址: http://localhost:$PORT"
echo "API 地址: http://localhost:$PORT/api"
echo "健康检查: curl http://localhost:$PORT/api/health"
echo ""
echo "添加令牌:"
echo "curl -X POST http://localhost:$PORT/api/tokens \\"
echo "  -H 'X-Admin-Password: affadsense' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"token\": \"hf_xxxxx\", \"name\": \"My Token\"}'"
echo ""
echo "查看日志: docker logs -f peinture"
echo "停止服务: docker stop peinture"
