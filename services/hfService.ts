import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";
import { tokenManager } from "./tokenManager";
import { ErrorCode, APIError, FailureReason } from "../types/tokenTypes";

const ZIMAGE_BASE_API_URL = "https://luca115-z-image-turbo.hf.space";
const QWEN_IMAGE_BASE_API_URL = "https://mcp-tools-qwen-image-fast.hf.space";
const UPSCALER_BASE_API_URL = "https://tuan2308-upscaler.hf.space";
const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";

// 4K resolution threshold
const RESOLUTION_4K = { width: 3840, height: 2160 };

const getZImageDimensions = (ratio: AspectRatioOption, enableHD: boolean): { width: number; height: number } => {
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
      case "1:1":
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
      case "1:1":
      default: return { width: 1024, height: 1024 };
    }
  }
};

// Get auth headers with token rotation support
const getAuthHeaders = (tokenValue?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (tokenValue) {
    headers["Authorization"] = `Bearer ${tokenValue}`;
  }
  
  return headers;
};

// Determine failure reason from error
const getFailureReason = (error: any): FailureReason => {
  if (error instanceof APIError) {
    switch (error.code) {
      case ErrorCode.TOKEN_INVALID:
        return FailureReason.AUTH_ERROR;
      case ErrorCode.TOKEN_QUOTA_EXCEEDED:
        return FailureReason.QUOTA_EXCEEDED;
      case ErrorCode.TIMEOUT_ERROR:
        return FailureReason.TIMEOUT;
      case ErrorCode.SERVER_ERROR:
        return FailureReason.SERVER_ERROR;
      default:
        return FailureReason.NETWORK_ERROR;
    }
  }
  
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
        isCompleteEvent = false;
        throw new APIError(
          ErrorCode.TOKEN_QUOTA_EXCEEDED,
          "Your today's quota has been used up. You can set up Hugging Face Token to get more quota."
        );
      } else {
        isCompleteEvent = false;
      }
    } else if (line.startsWith('data:') && isCompleteEvent) {
      const jsonData = line.substring(5).trim();
      try {
        return JSON.parse(jsonData);
      } catch (e) {
        console.error("Error parsing JSON data:", e);
        return null;
      }
    }
  }
  return null;
}

// Execute API call with token rotation and failover
async function executeWithTokenRotation<T>(
  apiCall: (token: string | null) => Promise<T>
): Promise<T> {
  const tokens = tokenManager.getTokens();
  const maxRetries = Math.max(tokens.length, 1);
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const token = tokenManager.getNextToken();
    const tokenValue = token?.token || null;
    
    const startTime = Date.now();
    
    try {
      const result = await apiCall(tokenValue);
      
      // Mark token as successful
      if (token) {
        const responseTime = Date.now() - startTime;
        tokenManager.markTokenSuccess(token.id, responseTime);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Mark token as failed
      if (token) {
        const reason = getFailureReason(error);
        tokenManager.markTokenFailure(token.id, reason);
      }
      
      // If no tokens available or this is the last attempt, throw
      if (tokens.length === 0 || attempt === maxRetries - 1) {
        break;
      }
      
      // Wait before retry for server errors
      if (error instanceof APIError && error.code === ErrorCode.SERVER_ERROR) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  // All tokens failed
  if (lastError) {
    throw lastError;
  }
  
  throw new APIError(
    ErrorCode.ALL_TOKENS_FAILED,
    "All tokens failed. Please check your tokens or try again later."
  );
}

const generateZImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed: number = Math.round(Math.random() * 1000000000),
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  const { width, height } = getZImageDimensions(aspectRatio, enableHD);

  return executeWithTokenRotation(async (tokenValue) => {
    const queue = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
      method: "POST",
      headers: getAuthHeaders(tokenValue),
      body: JSON.stringify({
        data: [prompt, height, width, 8, seed, false]
      })
    });
    
    if (!queue.ok) {
      throw new APIError(
        queue.status === 429 ? ErrorCode.TOKEN_QUOTA_EXCEEDED : ErrorCode.GENERATION_FAILED,
        `API request failed: ${queue.status}`
      );
    }
    
    const { event_id } = await queue.json();
    const response = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
      headers: getAuthHeaders(tokenValue)
    });
    const result = await response.text();
    const data = extractCompleteEventData(result);

    if (!data) {
      throw new APIError(ErrorCode.GENERATION_FAILED, "Failed to parse generation result");
    }

    return {
      id: crypto.randomUUID(),
      url: data[0].url,
      model: 'z-image-turbo',
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      seed: data[1]
    };
  });
};

const generateQwenImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number
): Promise<GeneratedImage> => {
  return executeWithTokenRotation(async (tokenValue) => {
    const queue = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
      method: "POST",
      headers: getAuthHeaders(tokenValue),
      body: JSON.stringify({
        data: [prompt, seed || 42, seed === undefined, aspectRatio, 3, 8]
      })
    });
    
    if (!queue.ok) {
      throw new APIError(
        queue.status === 429 ? ErrorCode.TOKEN_QUOTA_EXCEEDED : ErrorCode.GENERATION_FAILED,
        `API request failed: ${queue.status}`
      );
    }
    
    const { event_id } = await queue.json();
    const response = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
      headers: getAuthHeaders(tokenValue)
    });
    const result = await response.text();
    const data = extractCompleteEventData(result);

    if (!data) {
      throw new APIError(ErrorCode.GENERATION_FAILED, "Failed to parse generation result");
    }

    return {
      id: crypto.randomUUID(),
      url: data[0].url,
      model: 'qwen-image-fast',
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      seed: parseInt(data[1].replace('Seed used for generation: ', ''))
    };
  });
};

// Validate generation parameters
const validateGenerationParams = (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption
): void => {
  if (!prompt || !prompt.trim()) {
    throw new APIError(ErrorCode.INVALID_PARAMS, "Prompt cannot be empty");
  }
  
  const validModels: ModelOption[] = ['z-image-turbo', 'qwen-image-fast'];
  if (!validModels.includes(model)) {
    throw new APIError(ErrorCode.INVALID_PARAMS, `Invalid model: ${model}`);
  }
  
  const validRatios: AspectRatioOption[] = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"];
  if (!validRatios.includes(aspectRatio)) {
    throw new APIError(ErrorCode.INVALID_PARAMS, `Invalid aspect ratio: ${aspectRatio}`);
  }
};

export const generateImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  // Validate parameters
  validateGenerationParams(model, prompt, aspectRatio);
  
  if (model === 'qwen-image-fast') {
    return generateQwenImage(prompt, aspectRatio, seed);
  } else {
    return generateZImage(prompt, aspectRatio, seed, enableHD);
  }
};

// Check if image is already 4K or higher
export const isImage4KOrHigher = (width: number, height: number): boolean => {
  const pixels = width * height;
  const threshold4K = RESOLUTION_4K.width * RESOLUTION_4K.height;
  return pixels >= threshold4K;
};

export const upscaler = async (
  url: string,
  currentResolution?: { width: number; height: number }
): Promise<{ url: string; isAlready4K?: boolean }> => {
  // Check if already 4K (idempotency)
  if (currentResolution && isImage4KOrHigher(currentResolution.width, currentResolution.height)) {
    return { 
      url, 
      isAlready4K: true 
    };
  }

  return executeWithTokenRotation(async (tokenValue) => {
    const queue = await fetch(UPSCALER_BASE_API_URL + '/gradio_api/call/realesrgan', {
      method: "POST",
      headers: getAuthHeaders(tokenValue),
      body: JSON.stringify({
        data: [{"path": url, "meta": {"_type": "gradio.FileData"}}, 'RealESRGAN_x4plus', 0.5, false, 4]
      })
    });
    
    if (!queue.ok) {
      throw new APIError(
        queue.status === 429 ? ErrorCode.TOKEN_QUOTA_EXCEEDED : ErrorCode.UPSCALE_FAILED,
        `Upscale API request failed: ${queue.status}`
      );
    }
    
    const { event_id } = await queue.json();
    const response = await fetch(UPSCALER_BASE_API_URL + '/gradio_api/call/realesrgan/' + event_id, {
      headers: getAuthHeaders(tokenValue)
    });
    const result = await response.text();
    const data = extractCompleteEventData(result);

    if (!data) {
      throw new APIError(ErrorCode.UPSCALE_FAILED, "Failed to parse upscale result");
    }

    return { url: data[0].url };
  });
};

export const optimizePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const response = await fetch(POLLINATIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: [
          {
            role: 'system',
            content: `I am a master AI image prompt engineering advisor, specializing in crafting prompts that yield cinematic, hyper-realistic, and deeply evocative visual narratives, optimized for advanced generative models.
My core purpose is to meticulously rewrite, expand, and enhance user's image prompts.
I transform prompts to create visually stunning images by rigorously optimizing elements such as dramatic lighting, intricate textures, compelling composition, and a distinctive artistic style.
My generated prompt output will be strictly under 300 words. Prior to outputting, I will internally validate that the refined prompt strictly adheres to the word count limit and effectively incorporates the intended stylistic and technical enhancements.
My output will consist exclusively of the refined image prompt text. It will commence immediately, with no leading whitespace.
The text will strictly avoid markdown, quotation marks, conversational preambles, explanations, or concluding remarks.
I will ensure the output text is in the same language as the user's prompts.`
          },
          {
            role: 'user',
            content: originalPrompt
          }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    return content || originalPrompt;
  } catch (error) {
    console.error("Prompt Optimization Error:", error);
    throw error;
  }
};
