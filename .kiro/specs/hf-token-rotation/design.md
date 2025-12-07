# 设计文档

## 概述

本设计文档描述了 Hugging Face 令牌轮询和故障转移系统的技术实现方案。该系统将增强现有的图像生成应用,提供多令牌管理、自动故障转移、API 调用支持和 4K 超清放大功能。

核心设计目标:
- 提高 API 调用的可靠性和可用性
- 均衡多个令牌的配额使用
- 提供无缝的故障转移机制
- 支持外部 API 集成
- 增强图像质量输出能力

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Settings UI  │  │  Image Gen   │  │   Upscaler   │      │
│  │   Component  │  │   Component  │  │   Component  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────────┐
│         │      Service Layer                  │              │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐      │
│  │    Token     │  │    Image     │  │   Upscaler   │      │
│  │   Manager    │  │  Generation  │  │   Service    │      │
│  │              │◄─┤   Service    │◄─┤              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼───────┐     │
│  │              API Client Layer                      │     │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │     │
│  │  │ HF Client  │  │  Retry     │  │   Error    │   │     │
│  │  │            │  │  Handler   │  │  Handler   │   │     │
│  │  └────────────┘  └────────────┘  └────────────┘   │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────┐
│                   Storage Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Token Pool   │  │  Token Stats │  │   Settings   │      │
│  │ (LocalStorage│  │ (LocalStorage│  │ (LocalStorage│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### 数据流

1. **图像生成流程**:
   - 用户提交生成请求 → Image Generation Service
   - Service 请求令牌 → Token Manager
   - Token Manager 返回可用令牌
   - Service 使用令牌调用 HF API
   - 如果失败,Token Manager 提供下一个令牌
   - 成功后返回图像 URL

2. **令牌轮询流程**:
   - Token Manager 维护令牌队列
   - 每次请求从队列头部取令牌
   - 使用后将令牌移到队列尾部
   - 失败的令牌标记状态但保留在队列中
   - 临时禁用的令牌跳过,等待恢复时间

## 组件和接口

### 1. Token Manager

**职责**: 管理令牌池、轮询策略、故障转移逻辑

**接口**:

```typescript
interface TokenManager {
  // 令牌管理
  addToken(token: string): Promise<void>;
  removeToken(tokenId: string): void;
  updateToken(tokenId: string, token: string): void;
  getTokens(): HFToken[];
  
  // 令牌获取
  getNextToken(): HFToken | null;
  markTokenSuccess(tokenId: string): void;
  markTokenFailure(tokenId: string, reason: FailureReason): void;
  
  // 令牌状态
  getTokenStats(tokenId: string): TokenStats;
  getAllTokenStats(): TokenStats[];
  resetTokenStats(tokenId: string): void;
}

interface HFToken {
  id: string;
  token: string;
  status: 'active' | 'disabled' | 'quota_exceeded';
  failureCount: number;
  lastUsed: number;
  disabledUntil?: number;
  usageCount: number;
}

interface TokenStats {
  tokenId: string;
  usageCount: number;
  successCount: number;
  failureCount: number;
  lastUsed: number;
  averageResponseTime: number;
}

enum FailureReason {
  AUTH_ERROR = 'auth_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error'
}
```

### 2. Image Generation Service

**职责**: 处理图像生成请求,协调令牌使用

**接口**:

```typescript
interface ImageGenerationService {
  generateImage(params: GenerationParams): Promise<GeneratedImage>;
  generateImageWithRetry(params: GenerationParams, maxRetries?: number): Promise<GeneratedImage>;
}

interface GenerationParams {
  model: ModelOption;
  prompt: string;
  aspectRatio: AspectRatioOption;
  seed?: number;
  enableHD?: boolean;
}
```

### 3. Upscaler Service

**职责**: 处理图像超清放大请求

**接口**:

```typescript
interface UpscalerService {
  upscale(imageUrl: string, targetResolution?: '4K' | '8K'): Promise<UpscaleResult>;
  canUpscale(imageUrl: string): Promise<boolean>;
}

interface UpscaleResult {
  url: string;
  originalResolution: { width: number; height: number };
  newResolution: { width: number; height: number };
  processingTime: number;
}
```

### 4. API Client

**职责**: 底层 HTTP 通信,错误处理,重试逻辑

**接口**:

```typescript
interface APIClient {
  request<T>(config: RequestConfig): Promise<APIResponse<T>>;
  setToken(token: string | null): void;
}

interface RequestConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  responseTime: number;
}
```

## 数据模型

### Token Pool Storage

存储在 `localStorage` 中,键名: `hf_token_pool`

```typescript
interface TokenPoolStorage {
  tokens: HFToken[];
  currentIndex: number;
  lastUpdated: number;
}
```

### Token Stats Storage

存储在 `localStorage` 中,键名: `hf_token_stats`

```typescript
interface TokenStatsStorage {
  stats: Record<string, TokenStats>;
  lastUpdated: number;
}
```

### Settings Storage

存储在 `localStorage` 中,键名: `hf_settings`

```typescript
interface HFSettings {
  enableTokenRotation: boolean;
  maxRetries: number;
  retryDelay: number;
  tokenDisableDuration: number; // 毫秒
  requestTimeout: number; // 毫秒
}
```

## 正确性属性

*属性是系统在所有有效执行中应该保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 令牌轮询一致性

*对于任意* 令牌池和任意连续的 N 次令牌请求(N 等于令牌池大小),每个令牌应该被使用恰好一次
**验证: 需求 2.1, 2.2, 2.3**

### 属性 2: 故障转移完整性

*对于任意* 令牌池,当某个令牌调用失败时,系统应该尝试池中的下一个可用令牌,直到所有令牌都被尝试或调用成功
**验证: 需求 3.1, 3.2, 3.3**

### 属性 3: 令牌禁用恢复

*对于任意* 被临时禁用的令牌,当当前时间超过 `disabledUntil` 时间戳时,该令牌应该重新变为可用状态
**验证: 需求 3.5**

### 属性 4: 令牌状态持久化

*对于任意* 令牌状态更新操作,更新后的状态应该立即同步到 localStorage,并且在页面刷新后能够恢复
**验证: 需求 6.5**

### 属性 5: API 参数验证

*对于任意* 图像生成请求,如果请求参数不符合规范(例如空提示词、无效的宽高比),系统应该在调用 API 之前返回验证错误
**验证: 需求 4.1, 4.5**

### 属性 6: 重试次数限制

*对于任意* API 调用,重试次数不应超过令牌池的大小,避免无限重试
**验证: 需求 7.4**

### 属性 7: 超时保护

*对于任意* API 请求,如果响应时间超过配置的超时时间(默认 30 秒),请求应该被中止并触发故障转移
**验证: 需求 7.1**

### 属性 8: 令牌格式验证

*对于任意* 添加到令牌池的令牌,系统应该验证其格式符合 Hugging Face 令牌规范(非空字符串,长度合理)
**验证: 需求 1.2**

### 属性 9: 空令牌池降级

*对于任意* 图像生成请求,当令牌池为空时,系统应该使用公共配额进行 API 调用而不是直接失败
**验证: 需求 1.5**

### 属性 10: 4K 放大幂等性

*对于任意* 已经是 4K 或更高分辨率的图像,超清放大服务应该返回提示信息而不是重复处理
**验证: 需求 5.3**

## 错误处理

### 错误类型

```typescript
enum ErrorCode {
  // 令牌相关
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_QUOTA_EXCEEDED = 'TOKEN_QUOTA_EXCEEDED',
  ALL_TOKENS_FAILED = 'ALL_TOKENS_FAILED',
  NO_TOKENS_AVAILABLE = 'NO_TOKENS_AVAILABLE',
  
  // 网络相关
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  
  // 参数相关
  INVALID_PARAMS = 'INVALID_PARAMS',
  INVALID_IMAGE_URL = 'INVALID_IMAGE_URL',
  
  // 服务相关
  GENERATION_FAILED = 'GENERATION_FAILED',
  UPSCALE_FAILED = 'UPSCALE_FAILED'
}

class APIError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}
```

### 错误处理策略

1. **认证错误 (401)**:
   - 标记令牌为无效
   - 立即尝试下一个令牌
   - 记录失败原因

2. **配额超限 (429)**:
   - 标记令牌为配额耗尽
   - 临时禁用令牌(可配置时长)
   - 尝试下一个令牌

3. **服务器错误 (5xx)**:
   - 等待 2 秒后重试
   - 使用下一个令牌
   - 记录服务器错误

4. **网络错误**:
   - 立即尝试下一个令牌
   - 不标记令牌为失败(可能是临时网络问题)

5. **超时错误**:
   - 中止当前请求
   - 尝试下一个令牌
   - 记录超时事件

6. **所有令牌失败**:
   - 返回详细错误信息
   - 建议用户检查令牌或稍后重试
   - 记录完整的失败链

## 测试策略

### 单元测试

使用 Vitest 作为测试框架,重点测试:

1. **Token Manager**:
   - 令牌添加、删除、更新
   - 令牌轮询逻辑
   - 令牌状态管理
   - 故障标记和恢复

2. **API Client**:
   - HTTP 请求构建
   - 错误响应处理
   - 超时处理
   - 重试逻辑

3. **Service 层**:
   - 参数验证
   - 令牌获取和使用
   - 错误传播

### 属性测试

使用 fast-check 库进行属性测试,每个测试运行至少 100 次迭代:

1. **属性 1 测试**: 生成随机令牌池和请求序列,验证轮询一致性
2. **属性 2 测试**: 模拟随机失败场景,验证故障转移逻辑
3. **属性 3 测试**: 生成随机时间戳,验证令牌恢复机制
4. **属性 4 测试**: 执行随机状态更新,验证持久化一致性
5. **属性 5 测试**: 生成随机无效参数,验证参数验证
6. **属性 6 测试**: 模拟连续失败,验证重试次数限制
7. **属性 7 测试**: 模拟慢响应,验证超时保护
8. **属性 8 测试**: 生成随机字符串,验证令牌格式验证
9. **属性 9 测试**: 测试空令牌池场景,验证降级行为
10. **属性 10 测试**: 生成不同分辨率图像,验证放大幂等性

每个属性测试必须使用注释标记:
```typescript
// Feature: hf-token-rotation, Property 1: 令牌轮询一致性
```

### 集成测试

1. 端到端图像生成流程
2. 令牌故障转移完整流程
3. 4K 超清放大流程
4. 设置界面交互

### 测试数据生成

使用 fast-check 生成器:

```typescript
// 令牌生成器
const tokenArb = fc.string({ minLength: 20, maxLength: 50 });

// 令牌池生成器
const tokenPoolArb = fc.array(tokenArb, { minLength: 1, maxLength: 10 });

// 生成参数生成器
const generationParamsArb = fc.record({
  model: fc.constantFrom('z-image-turbo', 'qwen-image-fast'),
  prompt: fc.string({ minLength: 1, maxLength: 500 }),
  aspectRatio: fc.constantFrom('1:1', '16:9', '9:16', '4:3', '3:4'),
  seed: fc.option(fc.integer({ min: 0, max: 1000000 })),
  enableHD: fc.boolean()
});
```

## 性能考虑

1. **令牌池大小**: 建议 3-10 个令牌,平衡配额和管理复杂度
2. **LocalStorage 优化**: 使用节流写入,避免频繁 I/O
3. **并发控制**: 同时最多 3 个图像生成请求
4. **缓存策略**: 缓存令牌验证结果 5 分钟
5. **超时设置**: 默认 30 秒,可配置

## 安全考虑

1. **令牌存储**: 使用 localStorage,仅客户端访问
2. **令牌传输**: 仅通过 HTTPS 传输
3. **令牌显示**: UI 中部分隐藏令牌(显示前 4 位和后 4 位)
4. **输入验证**: 严格验证所有用户输入
5. **错误信息**: 不在错误信息中暴露完整令牌

## 实现优先级

### Phase 1: 核心令牌管理
- Token Manager 基础实现
- 令牌池存储和加载
- 基本轮询逻辑

### Phase 2: 故障转移
- 错误检测和分类
- 令牌状态管理
- 自动重试机制

### Phase 3: UI 集成
- 设置界面更新
- 令牌列表管理
- 状态显示

### Phase 4: 增强功能
- 4K 超清放大
- API 调用支持
- 性能监控

## 向后兼容性

- 保持现有单令牌配置兼容
- 自动迁移旧的 `huggingFaceToken` 到新的令牌池
- 保持现有 API 接口不变
- 新功能通过配置开关控制
