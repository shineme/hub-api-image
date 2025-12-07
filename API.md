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

**请求示例:**
```bash
curl http://localhost:3001/api/health
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

#### 单个添加

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

#### 批量添加

**请求参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tokens | array | ✅ | 令牌数组，可以是字符串或对象 |

**请求示例:**
```bash
curl -X POST http://localhost:3001/api/tokens \
  -H "X-Admin-Password: affadsense" \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": [
      "hf_token_111111",
      "hf_token_222222",
      {"token": "hf_token_333333", "name": "Token 3"}
    ]
  }'
```

**成功响应:**
```json
{
  "success": true,
  "message": "Added 3/3 tokens",
  "results": [
    {"token": "hf_token...", "success": true, "message": "Added"},
    {"token": "hf_token...", "success": true, "message": "Added"},
    {"token": "hf_token...", "success": true, "message": "Added"}
  ]
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

### 8. 重置禁用令牌 (需要管理密码)

```
POST /api/tokens/reset
X-Admin-Password: affadsense
```

**请求示例:**
```bash
curl -X POST http://localhost:3001/api/tokens/reset \
  -H "X-Admin-Password: affadsense"
```

**成功响应:**
```json
{
  "success": true,
  "message": "Reset 2 disabled tokens",
  "resetCount": 2
}
```

---

### 9. API 文档

```
GET /api
```

**请求示例:**
```bash
curl http://localhost:3001/api
```

**响应:**
```json
{
  "name": "Peinture API",
  "version": "1.0.0",
  "endpoints": {
    "GET /api/health": "Health check",
    "POST /api/generate": "Generate image (body: {prompt, model?, aspectRatio?, seed?, enableHD?})",
    "POST /api/upscale": "Upscale image to 4K (body: {url, width?, height?})",
    "POST /api/optimize-prompt": "Optimize prompt (body: {prompt})",
    "GET /api/tokens/stats": "Get token stats (header: X-Admin-Password)",
    "POST /api/tokens": "Add token(s) (header: X-Admin-Password, body: {token, name?} or {tokens: [...]})",
    "DELETE /api/tokens/:id": "Remove token (header: X-Admin-Password)"
  }
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

---

## 前端调用示例

本应用提供图片生成和 4K 放大功能，以下是前端 JavaScript/TypeScript 调用方式。

### 1. 生成图片

```typescript
// 基础调用
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A beautiful sunset over mountains',
    model: 'z-image-turbo',
    aspectRatio: '16:9',
    enableHD: true
  })
});
const result = await response.json();

if (result.success) {
  console.log('图片 URL:', result.url);
  console.log('种子:', result.seed);
} else {
  console.error('错误:', result.message);
}
```

```typescript
// 使用 qwen-image-fast 模型
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '一只可爱的猫咪',
    model: 'qwen-image-fast',
    aspectRatio: '1:1',
    seed: 12345
  })
});
```

### 2. 4K 放大

```typescript
const response = await fetch('/api/upscale', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com/image.jpg',
    width: 1024,
    height: 768
  })
});
const result = await response.json();

if (result.success) {
  if (result.isAlready4K) {
    console.log('图片已是 4K，无需放大');
  } else {
    console.log('放大后 URL:', result.url);
  }
}
```

### 3. 优化提示词

```typescript
const response = await fetch('/api/optimize-prompt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A cat'
  })
});
const result = await response.json();

if (result.success) {
  console.log('原始提示词:', result.original);
  console.log('优化后:', result.optimized);
}
```

### 4. 健康检查

```typescript
const response = await fetch('/api/health');
const result = await response.json();

console.log('服务状态:', result.status);
console.log('令牌数量:', result.tokenCount);
```

### 5. 令牌管理 (需要管理密码)

```typescript
// 获取令牌统计
const statsResponse = await fetch('/api/tokens/stats', {
  headers: { 'X-Admin-Password': 'your-admin-password' }
});
const stats = await statsResponse.json();

// 添加单个令牌
const addResponse = await fetch('/api/tokens', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Password': 'your-admin-password'
  },
  body: JSON.stringify({
    token: 'hf_xxxxx',
    name: 'My Token'
  })
});

// 批量添加令牌
const batchResponse = await fetch('/api/tokens', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Password': 'your-admin-password'
  },
  body: JSON.stringify({
    tokens: [
      'hf_token_111111',
      { token: 'hf_token_222222', name: 'Token 2' }
    ]
  })
});

// 删除令牌
const deleteResponse = await fetch('/api/tokens/token-id-here', {
  method: 'DELETE',
  headers: { 'X-Admin-Password': 'your-admin-password' }
});

// 重置禁用令牌
const resetResponse = await fetch('/api/tokens/reset', {
  method: 'POST',
  headers: { 'X-Admin-Password': 'your-admin-password' }
});
```

### 6. 错误处理

```typescript
async function generateWithErrorHandling(prompt: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    const result = await response.json();
    
    if (!response.ok || result.error) {
      switch (result.code) {
        case 'INVALID_PARAMS':
          console.error('参数无效:', result.message);
          break;
        case 'QUOTA_EXCEEDED':
          console.error('配额已用完，请稍后重试');
          break;
        case 'ALL_TOKENS_FAILED':
          console.error('所有令牌失败，请添加更多令牌');
          break;
        default:
          console.error('生成失败:', result.message);
      }
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('网络错误:', error);
    return null;
  }
}
```

### 7. React Hook 示例

```typescript
import { useState } from 'react';

function useImageGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (prompt: string, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
      });
      
      const result = await response.json();
      
      if (result.error) {
        setError(result.message);
        return null;
      }
      
      return result;
    } catch (err) {
      setError('网络请求失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, error };
}

// 使用示例
function ImageGenerator() {
  const { generate, loading, error } = useImageGeneration();
  
  const handleGenerate = async () => {
    const result = await generate('A cute cat', {
      model: 'z-image-turbo',
      aspectRatio: '16:9'
    });
    
    if (result) {
      console.log('生成成功:', result.url);
    }
  };
  
  return (
    <button onClick={handleGenerate} disabled={loading}>
      {loading ? '生成中...' : '生成图片'}
    </button>
  );
}
```
