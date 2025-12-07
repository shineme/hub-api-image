# 多阶段构建 - 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖 (包括 devDependencies)
RUN npm ci

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 安装 dumb-init 用于正确处理信号
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production && \
    npm cache clean --force

# 安装 tsx 用于运行 TypeScript
RUN npm install tsx

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist

# 复制服务器代码
COPY server ./server

# 创建数据目录
RUN mkdir -p data logs && \
    chown -R nodejs:nodejs /app

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 启动命令
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "node_modules/.bin/tsx", "server/index.ts"]
