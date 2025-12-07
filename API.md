# HTTP API 文档

> 📖 VPS 部署请参考 [DEPLOY.md](./DEPLOY.md)

## 启动 API 服务器

### 本地开发

```bash
# 安装依赖
npm install

# 启动 API 服务器 (端口 3001)
npm run server

# 开发模式 (自动重启)
npm run server:dev
```

### 生产部署 (PM2)

```bash
# 一键部署
chmod +x deploy.sh && ./deploy.sh

# 或手动启动
pm2 start ecosystem.config.cjs
```

服务器地址: `http://localhost:3001`

---

## API 接口

### 1. 健康检查

```
GET /api/health
```

**响应:**
```json
{
  "status": "ok",
  "timestamp": 1733580000000,
  "tokenCount": 3
}
```

---

### 2. 生成图片

```
POST /api/generate
Content-Type: application/json
```

**请求参数:**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| prompt | string | ✅ | - | 图片描述 |
| model | string | ❌ | z-image-turbo | 模型: `z-image-turbo` 或 `qwen-image-fast` |
| aspectRatio | string | ❌ | 1:1 | 宽高比 |
| seed | number | ❌ | 随机 | 随机种子 |
| enableHD | boolean | ❌ | false | 高清模式 (仅 z-image-turbo) |

**宽高比选项:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `5:4`, `4:5`

**请求示例:**
```bash
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "model": "z-image-turbo",
    "aspectRatio": "16:9",
    "enableHD": true
  }'
```

**成功响应:**
```json
{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://..../image.png",
  "model": "z-image-turbo",
  "prompt": "A beautiful sunset over mountains",
  "aspectRatio": "16:9",
  "seed": 123456789,
  "timestamp": 1733580000000
}
```

**错误响应:**
```json
{
  "error": true,
  "code": "INVALID_PARAMS",
  "message": "Prompt is required"
}
```

---

### 3. 4K 放大

```
POST /api/upscale
Content-Type: application/json
```

**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | ✅ | 图片 URL |
| width | number | ❌ | 当前宽度 (用于 4K 检测) |
| height | number | ❌ | 当前高度 (用于 4K 检测) |

**请求示例:**
```bash
curl -X POST http://localhost:3001/api/upscale \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/image.jpg",
    "width": 1024,
    "height": 768
  }'
```

**成功响应:**
```json
{
  "success": true,
  "url": "https://..../upscaled.png"
}
```

**已是 4K 响应:**
```json
{
  "success": true,
  "url": "https://example.com/image.jpg",
  "isAlready4K": true
}
```

---

### 4. 优化提示词

```
POST /api/optimize-prompt
Content-Type: application/json
```

**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | ✅ | 原始提示词 |

**请求示例:**
```bash
curl -X POST http://localhost:3001/api/optimize-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cat"
  }'
```

**成功响应:**
```json
{
  "success": true,
  "original": "A cat",
  "optimized": "A majestic Persian cat with piercing emerald eyes, soft fluffy fur illuminated by warm golden hour sunlight..."
}
```

---

### 5. 令牌统计 (需要管理密码)

```
GET /api/tokens/stats
X-Admin-Password: affadsense
```

**请求示例:**
```bash
curl http://localhost:3001/api/tokens/stats \
  -H "X-Admin-Password: affadsense"
```

**成功响应:**
```json
{
  "totalTokens": 3,
  "activeTokens": 2,
  "stats": [
    {
      "id": "token-id-1",
      "name": "Token 1",
      "isDisabled": false,
      "consecutiveFailures": 0,
      "totalRequests": 150,
      "successCount": 145,
      "failureCount": 5,
      "lastUsed": 1733580000000,
      "averageResponseTime": 2500
    }
  ]
}
```

---

### 6. 添加令牌 (需要管理密码)

```
POST /api/tokens
X-Admin-Password: affadsense
Content-Type: application/json
```

**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| token | string | ✅ | Hugging Face Token (hf_xxx) |
| name | string | ❌ | 令牌名称 |

**请求示例:**
```bash
curl -X POST http://localhost:3001/api/tokens \
  -H "X-Admin-Password: affadsense" \
  -H "Content-Type: application/json" \
  -d '{"token": "hf_xxxxx", "name": "My Token"}'
```

**成功响应:**
```json
{
  "success": true,
  "message": "Token added successfully"
}
```

---

### 7. 删除令牌 (需要管理密码)

```
DELETE /api/tokens/:id
X-Admin-Password: affadsense
```

**请求示例:**
```bash
curl -X DELETE http://localhost:3001/api/tokens/token-id-here \
  -H "X-Admin-Password: affadsense"
```

**成功响应:**
```json
{
  "success": true,
  "message": "Token removed successfully"
}
```

---

## 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| INVALID_PARAMS | 400 | 参数无效 |
| UNAUTHORIZED | 401 | 未授权 |
| QUOTA_EXCEEDED | 429 | 配额耗尽 |
| GENERATION_FAILED | 500 | 生成失败 |
| UPSCALE_FAILED | 500 | 放大失败 |
| OPTIMIZE_FAILED | 500 | 优化失败 |
| ALL_TOKENS_FAILED | 500 | 所有令牌失败 |

---

## 令牌管理

### 添加令牌

在 `data/tokens.json` 文件中手动添加，或通过前端后台管理页面添加。

**文件格式:**
```json
[
  {
    "id": "uuid",
    "token": "hf_xxxxx",
    "name": "My Token",
    "isDisabled": false,
    "disabledUntil": null,
    "consecutiveFailures": 0,
    "createdAt": 1733580000000
  }
]
```

### 获取 Hugging Face Token

1. 访问 https://huggingface.co/settings/tokens
2. 点击 "New token"
3. 选择 "Read" 权限
4. 复制生成的 token (以 `hf_` 开头)

---

## 特性

- **自动轮询**: 多个令牌轮流使用，提高配额
- **故障转移**: 单个令牌失败自动切换下一个
- **智能禁用**: 连续失败 3 次的令牌临时禁用 5 分钟
- **统计追踪**: 记录每个令牌的调用次数、成功率、响应时间
- **4K 幂等性**: 已是 4K 的图片不会重复放大
