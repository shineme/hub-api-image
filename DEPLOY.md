# VPS 部署指南

> 推荐使用 Docker 部署，更简单快捷！

## 目录

- [Docker 部署 (推荐)](#docker-部署-推荐)
- [手动部署](#手动部署)

---

## Docker 部署 (推荐)

### 方式一：使用预构建镜像

```bash
# 1. 创建目录
mkdir -p peinture && cd peinture

# 2. 下载 docker-compose.yml
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/peinture/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/peinture/main/nginx.docker.conf

# 3. 创建数据目录
mkdir -p data logs

# 4. 启动服务
docker compose up -d

# 5. 查看日志
docker compose logs -f
```

### 方式二：从源码构建

```bash
# 1. 克隆代码
git clone https://github.com/YOUR_USERNAME/peinture.git
cd peinture

# 2. 构建并启动
docker compose up -d --build

# 3. 查看状态
docker compose ps
```

### 方式三：使用 GitHub Container Registry

```bash
# 拉取最新镜像
docker pull ghcr.io/YOUR_USERNAME/peinture:latest

# 运行容器
docker run -d \
  --name peinture \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  ghcr.io/YOUR_USERNAME/peinture:latest
```

### Docker 常用命令

```bash
docker compose up -d      # 启动
docker compose down       # 停止
docker compose restart    # 重启
docker compose logs -f    # 查看日志
docker compose pull       # 更新镜像
```

### 带 Nginx 的完整部署

```bash
# 启动 API + Nginx
docker compose --profile with-nginx up -d
```

访问: `http://your-server-ip`

---

## 手动部署

### 一、环境准备

### 1. 安装 Node.js (推荐 v18+)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node -v
npm -v
```

### 2. 安装 PM2 (进程管理)

```bash
sudo npm install -g pm2
```

### 3. 安装 Nginx (反向代理)

```bash
# Ubuntu/Debian
sudo apt-get install -y nginx

# CentOS/RHEL
sudo yum install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 二、部署项目

### 1. 上传代码到 VPS

```bash
# 方式1: Git 克隆
cd /var/www
git clone <your-repo-url> peinture
cd peinture

# 方式2: 直接上传
# 使用 scp 或 sftp 上传项目文件到 /var/www/peinture
```

### 2. 安装依赖

```bash
cd /var/www/peinture
npm install
```

### 3. 构建前端

```bash
npm run build
```

### 4. 创建数据目录

```bash
mkdir -p data
chmod 755 data
```

---

## 三、配置 PM2

### 1. 创建 PM2 配置文件

项目已包含 `ecosystem.config.cjs`，直接使用：

```bash
# 启动服务
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs peinture-api

# 设置开机自启
pm2 startup
pm2 save
```

### 2. PM2 常用命令

```bash
pm2 restart peinture-api  # 重启
pm2 stop peinture-api     # 停止
pm2 delete peinture-api   # 删除
pm2 logs peinture-api     # 查看日志
pm2 monit                 # 监控面板
```

---

## 四、配置 Nginx

### 1. 创建 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/peinture
```

粘贴以下内容（替换 `your-domain.com`）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/peinture/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

### 2. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/peinture /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 五、配置 HTTPS (可选但推荐)

### 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书 (替换域名)
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 六、防火墙配置

```bash
# Ubuntu (ufw)
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 七、添加 Hugging Face Token

### 方式1: 通过 API

```bash
curl -X POST http://your-domain.com/api/tokens \
  -H "X-Admin-Password: affadsense" \
  -H "Content-Type: application/json" \
  -d '{"token": "hf_xxxxx", "name": "Token 1"}'
```

### 方式2: 直接编辑文件

```bash
nano /var/www/peinture/data/tokens.json
```

```json
[
  {
    "id": "uuid-1",
    "token": "hf_xxxxx",
    "name": "Token 1",
    "isDisabled": false,
    "disabledUntil": null,
    "consecutiveFailures": 0,
    "createdAt": 1733580000000
  }
]
```

---

## 八、验证部署

### 1. 检查服务状态

```bash
# PM2 状态
pm2 status

# API 健康检查
curl http://localhost:3001/api/health

# Nginx 状态
sudo systemctl status nginx
```

### 2. 测试 API

```bash
# 生成图片
curl -X POST http://your-domain.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A beautiful sunset"}'
```

### 3. 访问前端

打开浏览器访问: `http://your-domain.com`

---

## 九、常见问题

### Q: API 返回 502 Bad Gateway
```bash
# 检查 API 服务是否运行
pm2 status
pm2 logs peinture-api

# 重启服务
pm2 restart peinture-api
```

### Q: 权限问题
```bash
# 确保 data 目录可写
sudo chown -R $USER:$USER /var/www/peinture/data
chmod 755 /var/www/peinture/data
```

### Q: 端口被占用
```bash
# 查看端口占用
sudo lsof -i :3001

# 修改端口 (在 ecosystem.config.cjs 中)
env: { PORT: 3002 }
```

### Q: 内存不足
```bash
# 查看内存使用
free -h

# 创建 swap (如果需要)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 十、更新部署

```bash
cd /var/www/peinture

# 拉取最新代码
git pull

# 安装依赖
npm install

# 重新构建前端
npm run build

# 重启 API 服务
pm2 restart peinture-api
```

---

## 快速部署脚本

创建 `deploy.sh`:

```bash
#!/bin/bash
cd /var/www/peinture
git pull
npm install
npm run build
pm2 restart peinture-api
echo "部署完成!"
```

使用:
```bash
chmod +x deploy.sh
./deploy.sh
```
