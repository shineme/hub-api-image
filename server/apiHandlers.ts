import { tokenManager, FailureReason } from './tokenManager.js';

// API URLs
const ZIMAGE_BASE_API_URL = "https://luca115-z-image-turbo.hf.space";
const QWEN_IMAGE_BASE_API_URL = "https://mcp-tools-qwen-image-fast.hf.space";
const UPSCALER_BASE_API_URL = "https://tuan2308-upscaler.hf.space";
const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";

// Types
type ModelOption = 'z-image-turbo' | 'qwen-image-fast';
type AspectRatioOption = "1:1" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";

interface GenerateRequest {
  model?: ModelOption;
  prompt: string;
  aspectRatio?: AspectRatioOption;
  seed?: number;
  enableHD?: boolean;
}

interface UpscaleRequest {
  url: string;
  width?: number;
  height?: number;
}

interface OptimizeRequest {
  prompt: string;
}

class APIError extends Error {
  status: number;
  code: string;
  
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Helper functions
const getZImageDimensions = (ratio: AspectRatioOption, enableHD: boolean) => {
  if (enableHD) {
    switch (ratio) {
      case "16:9": return { width: 2048, height: 1152 };
      case "5:4": return { width: 1920, height: 1536 };
      case "4:3": return { width: 2048, height: 1536 };
      case "3:2": return { width: 1920, height: 1280 };
      case "9:16": return { width: 1152, height: 2048 };
      case "4:5": return { width: 1536, height: 1920 };
      case "3:4": return { width: 1536, height: 2048 };
      case "2:3": return { width: 1280, height: 1920 };
      default: return { width: 2048, height: 2048 };
    }
  } else {
    switch (ratio) {
      case "16:9": return { width: 1280, height: 720 };
      case "5:4": return { width: 1280, height: 1024 };
      case "4:3": return { width: 1024, height: 768 };
      case "3:2": return { width: 1536, height: 1024 };
      case "9:16": return { width: 720, height: 1280 };
      case "4:5": return { width: 1024, height: 1280 };
      case "3:4": return { width: 768, height: 1024 };
      case "2:3": return { width: 1024, height: 1536 };
      default: return { width: 1024, height: 1024 };
    }
  }
};

const getAuthHeaders = (tokenValue?: string | null): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokenValue) headers["Authorization"] = `Bearer ${tokenValue}`;
  return headers;
};

const getFailureReason = (error: any): FailureReason => {
  const message = error?.message?.toLowerCase() || '';
  if (message.includes('quota') || message.includes('rate limit') || message.includes('429')) {
    return FailureReason.QUOTA_EXCEEDED;
  }
  if (message.includes('auth') || message.includes('401') || message.includes('403')) {
    return FailureReason.AUTH_ERROR;
  }
  if (message.includes('timeout')) {
    return FailureReason.TIMEOUT;
  }
  return FailureReason.NETWORK_ERROR;
};

function extractCompleteEventData(sseStream: string): any | null {
  const lines = sseStream.split('\n');
  let isCompleteEvent = false;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      const eventType = line.substring(6).trim();
      if (eventType === 'complete') {
        isCompleteEvent = true;
      } else if (eventType === 'error') {
        throw new APIError(429, 'QUOTA_EXCEEDED', "Today's quota has been used up");
      } else {
        isCompleteEvent = false;
      }
    } else if (line.startsWith('data:') && isCompleteEvent) {
      try {
        return JSON.parse(line.substring(5).trim());
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

// Execute with token rotation
async function executeWithTokenRotation<T>(apiCall: (token: string | null) => Promise<T>): Promise<T> {
  const allTokens = tokenManager.getTokens();
  const maxRetries = Math.max(allTokens.length, 1);
  let lastError: Error | null = null;
  const triedTokenIds = new Set<string>();
  
  console.log(`[TokenRotation] Starting with ${allTokens.length} tokens available, max retries: ${maxRetries}`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const token = tokenManager.getNextToken();
    
    // Skip if we've already tried this token
    if (token && triedTokenIds.has(token.id)) {
      console.log(`[TokenRotation] Skipping already tried token: ${token.id.substring(0, 8)}...`);
      continue;
    }
    
    if (token) {
      triedTokenIds.add(token.id);
    }
    
    const tokenValue = token?.token || null;
    const startTime = Date.now();
    
    console.log(`[TokenRotation] Attempt ${attempt + 1}/${maxRetries}, using token: ${token ? token.id.substring(0, 8) + '...' : 'none'}`);
    
    try {
      const result = await apiCall(tokenValue);
      if (token) {
        const responseTime = Date.now() - startTime;
        tokenManager.markTokenSuccess(token.id, responseTime);
        console.log(`[TokenRotation] Success with token ${token.id.substring(0, 8)}... in ${responseTime}ms`);
      }
      return result;
    } catch (error: any) {
      lastError = error;
      const reason = getFailureReason(error);
      
      console.log(`[TokenRotation] Failed with token ${token ? token.id.substring(0, 8) + '...' : 'none'}: ${error.message} (reason: ${reason})`);
      
      if (token) {
        tokenManager.markTokenFailure(token.id, reason);
      }
      
      // If no tokens at all, break immediately
      if (allTokens.length === 0) {
        console.log(`[TokenRotation] No tokens available, breaking`);
        break;
      }
      
      // Check if there are more available tokens to try
      const availableTokens = tokenManager.getTokens().filter(t => !t.isDisabled && !triedTokenIds.has(t.id));
      if (availableTokens.length === 0) {
        console.log(`[TokenRotation] No more available tokens to try`);
        break;
      }
      
      // Add a small delay before retrying
      if (attempt < maxRetries - 1) {
        console.log(`[TokenRotation] Waiting 500ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  console.log(`[TokenRotation] All attempts failed, tried ${triedTokenIds.size} tokens`);
  throw lastError || new APIError(500, 'ALL_TOKENS_FAILED', 'All tokens failed. Please add more tokens or try again later.');
}

// ============ API Handlers ============

export async function generateImageAPI(body: GenerateRequest) {
  const { model = 'z-image-turbo', prompt, aspectRatio = '1:1', seed, enableHD = false } = body;
  
  // Validate
  if (!prompt || !prompt.trim()) {
    throw new APIError(400, 'INVALID_PARAMS', 'Prompt is required');
  }
  
  const validModels: ModelOption[] = ['z-image-turbo', 'qwen-image-fast'];
  if (!validModels.includes(model)) {
    throw new APIError(400, 'INVALID_PARAMS', `Invalid model: ${model}`);
  }
  
  const validRatios: AspectRatioOption[] = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];
  if (!validRatios.includes(aspectRatio)) {
    throw new APIError(400, 'INVALID_PARAMS', `Invalid aspectRatio: ${aspectRatio}`);
  }

  if (model === 'qwen-image-fast') {
    return executeWithTokenRotation(async (tokenValue) => {
      const queue = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
        method: "POST",
        headers: getAuthHeaders(tokenValue),
        body: JSON.stringify({ data: [prompt, seed || 42, seed === undefined, aspectRatio, 3, 8] })
      });
      
      if (!queue.ok) throw new APIError(queue.status, 'GENERATION_FAILED', `API error: ${queue.status}`);
      
      const { event_id } = await queue.json();
      const response = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
        headers: getAuthHeaders(tokenValue)
      });
      const data = extractCompleteEventData(await response.text());
      
      if (!data) throw new APIError(500, 'GENERATION_FAILED', 'Failed to parse result');
      
      return {
        success: true,
        id: crypto.randomUUID(),
        url: data[0].url,
        model,
        prompt,
        aspectRatio,
        seed: parseInt(data[1].replace('Seed used for generation: ', '')),
        timestamp: Date.now()
      };
    });
  } else {
    const { width, height } = getZImageDimensions(aspectRatio, enableHD);
    const finalSeed = seed ?? Math.round(Math.random() * 1000000000);
    
    return executeWithTokenRotation(async (tokenValue) => {
      const queue = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
        method: "POST",
        headers: getAuthHeaders(tokenValue),
        body: JSON.stringify({ data: [prompt, height, width, 8, finalSeed, false] })
      });
      
      if (!queue.ok) throw new APIError(queue.status, 'GENERATION_FAILED', `API error: ${queue.status}`);
      
      const { event_id } = await queue.json();
      const response = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
        headers: getAuthHeaders(tokenValue)
      });
      const data = extractCompleteEventData(await response.text());
      
      if (!data) throw new APIError(500, 'GENERATION_FAILED', 'Failed to parse result');
      
      return {
        success: true,
        id: crypto.randomUUID(),
        url: data[0].url,
        model,
        prompt,
        aspectRatio,
        seed: data[1],
        timestamp: Date.now()
      };
    });
  }
}

export async function upscaleImageAPI(body: UpscaleRequest) {
  const { url, width, height } = body;
  
  if (!url) {
    throw new APIError(400, 'INVALID_PARAMS', 'Image URL is required');
  }
  
  // Check if already 4K
  if (width && height) {
    const pixels = width * height;
    const threshold4K = 3840 * 2160;
    if (pixels >= threshold4K) {
      return { success: true, url, isAlready4K: true };
    }
  }
  
  return executeWithTokenRotation(async (tokenValue) => {
    const queue = await fetch(UPSCALER_BASE_API_URL + '/gradio_api/call/realesrgan', {
      method: "POST",
      headers: getAuthHeaders(tokenValue),
      body: JSON.stringify({
        data: [{ "path": url, "meta": { "_type": "gradio.FileData" } }, 'RealESRGAN_x4plus', 0.5, false, 4]
      })
    });
    
    if (!queue.ok) throw new APIError(queue.status, 'UPSCALE_FAILED', `API error: ${queue.status}`);
    
    const { event_id } = await queue.json();
    const response = await fetch(UPSCALER_BASE_API_URL + '/gradio_api/call/realesrgan/' + event_id, {
      headers: getAuthHeaders(tokenValue)
    });
    const data = extractCompleteEventData(await response.text());
    
    if (!data) throw new APIError(500, 'UPSCALE_FAILED', 'Failed to parse result');
    
    return { success: true, url: data[0].url };
  });
}

export async function optimizePromptAPI(body: OptimizeRequest) {
  const { prompt } = body;
  
  if (!prompt || !prompt.trim()) {
    throw new APIError(400, 'INVALID_PARAMS', 'Prompt is required');
  }
  
  const response = await fetch(POLLINATIONS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai-fast',
      messages: [
        {
          role: 'system',
          content: `I am a master AI image prompt engineering advisor. My core purpose is to rewrite and enhance user's image prompts. Output will be under 300 words, in the same language as input, with no markdown or explanations.`
        },
        { role: 'user', content: prompt }
      ],
      stream: false
    }),
  });

  if (!response.ok) {
    throw new APIError(response.status, 'OPTIMIZE_FAILED', 'Failed to optimize prompt');
  }

  const data = await response.json();
  const optimized = data.choices?.[0]?.message?.content || prompt;
  
  return { success: true, original: prompt, optimized };
}
