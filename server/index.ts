import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { tokenManager } from './tokenManager.js';
import { generateImageAPI, upscaleImageAPI, optimizePromptAPI } from './apiHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    tokenCount: tokenManager.getTokens().length
  });
});

// API documentation
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'Peinture API',
    version: '1.0.0',
    endpoints: {
      'GET /api/health': 'Health check',
      'POST /api/generate': 'Generate image (body: {prompt, model?, aspectRatio?, seed?, enableHD?})',
      'POST /api/upscale': 'Upscale image to 4K (body: {url, width?, height?})',
      'POST /api/optimize-prompt': 'Optimize prompt (body: {prompt})',
      'GET /api/tokens/stats': 'Get token stats (header: X-Admin-Password)',
      'POST /api/tokens': 'Add token(s) (header: X-Admin-Password, body: {token, name?} or {tokens: [...]})',
      'DELETE /api/tokens/:id': 'Remove token (header: X-Admin-Password)'
    },
    example: {
      generate: 'curl -X POST http://localhost:3001/api/generate -H "Content-Type: application/json" -d \'{"prompt": "A cute cat"}\''
    }
  });
});

// GET request hints for POST endpoints
app.get('/api/generate', (_req: Request, res: Response) => {
  res.status(405).json({
    error: true,
    message: 'Use POST method',
    example: 'curl -X POST http://localhost:3001/api/generate -H "Content-Type: application/json" -d \'{"prompt": "A cute cat", "aspectRatio": "16:9"}\''
  });
});

app.get('/api/upscale', (_req: Request, res: Response) => {
  res.status(405).json({
    error: true,
    message: 'Use POST method',
    example: 'curl -X POST http://localhost:3001/api/upscale -H "Content-Type: application/json" -d \'{"url": "https://example.com/image.jpg"}\''
  });
});

app.get('/api/optimize-prompt', (_req: Request, res: Response) => {
  res.status(405).json({
    error: true,
    message: 'Use POST method',
    example: 'curl -X POST http://localhost:3001/api/optimize-prompt -H "Content-Type: application/json" -d \'{"prompt": "A dog"}\''
  });
});

// ============ Image Generation API ============

/**
 * POST /api/generate
 * Generate an image from text prompt
 */
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const result = await generateImageAPI(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(error.status || 500).json({
      error: true,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Failed to generate image'
    });
  }
});

/**
 * POST /api/upscale
 * Upscale an image to 4K
 */
app.post('/api/upscale', async (req: Request, res: Response) => {
  try {
    const result = await upscaleImageAPI(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(error.status || 500).json({
      error: true,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Failed to upscale image'
    });
  }
});

/**
 * POST /api/optimize-prompt
 * Optimize a text prompt for better image generation
 */
app.post('/api/optimize-prompt', async (req: Request, res: Response) => {
  try {
    const result = await optimizePromptAPI(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(error.status || 500).json({
      error: true,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Failed to optimize prompt'
    });
  }
});

// ============ Token Management API ============

// Admin auth middleware
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const password = req.headers['x-admin-password'];
  if (password !== 'affadsense') {
    return res.status(401).json({ error: true, message: 'Unauthorized' });
  }
  next();
};

/**
 * GET /api/tokens/stats
 * Get token statistics (requires admin password)
 */
app.get('/api/tokens/stats', adminAuth, (_req: Request, res: Response) => {
  const tokens = tokenManager.getTokens();
  const stats = tokenManager.getAllTokenStats();
  
  res.json({
    totalTokens: tokens.length,
    activeTokens: tokens.filter(t => !t.isDisabled).length,
    stats: tokens.map(t => ({
      id: t.id,
      token: t.token, // 返回完整 token 供管理界面显示
      name: t.name,
      isDisabled: t.isDisabled,
      disabledUntil: t.disabledUntil,
      consecutiveFailures: t.consecutiveFailures,
      createdAt: t.createdAt,
      ...stats[t.id]
    }))
  });
});

/**
 * POST /api/tokens
 * Add a new token (requires admin password)
 * Body: {token, name?} or {tokens: [{token, name?}, ...]}
 */
app.post('/api/tokens', adminAuth, (req: Request, res: Response) => {
  const { token, name, tokens } = req.body;
  
  // 批量添加
  if (tokens && Array.isArray(tokens)) {
    const results: { token: string; success: boolean; message: string }[] = [];
    let successCount = 0;
    
    for (const item of tokens) {
      const t = typeof item === 'string' ? item : item.token;
      const n = typeof item === 'string' ? undefined : item.name;
      
      if (!t) {
        results.push({ token: '(empty)', success: false, message: 'Token is empty' });
        continue;
      }
      
      const success = tokenManager.addToken(t, n);
      if (success) {
        successCount++;
        results.push({ token: t.substring(0, 8) + '...', success: true, message: 'Added' });
      } else {
        results.push({ token: t.substring(0, 8) + '...', success: false, message: 'Invalid or exists' });
      }
    }
    
    return res.json({
      success: successCount > 0,
      message: `Added ${successCount}/${tokens.length} tokens`,
      results
    });
  }
  
  // 单个添加
  if (!token) {
    return res.status(400).json({ error: true, message: 'Token is required' });
  }
  
  const success = tokenManager.addToken(token, name);
  if (!success) {
    return res.status(400).json({ error: true, message: 'Invalid token or already exists' });
  }
  
  res.json({ success: true, message: 'Token added successfully' });
});

/**
 * DELETE /api/tokens/:id
 * Remove a token (requires admin password)
 */
app.delete('/api/tokens/:id', adminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  
  const success = tokenManager.removeToken(id);
  if (!success) {
    return res.status(404).json({ error: true, message: 'Token not found' });
  }
  
  res.json({ success: true, message: 'Token removed successfully' });
});

/**
 * POST /api/tokens/reset
 * Reset all disabled tokens (requires admin password)
 */
app.post('/api/tokens/reset', adminAuth, (_req: Request, res: Response) => {
  const tokens = tokenManager.getTokens();
  let resetCount = 0;
  
  for (const token of tokens) {
    if (token.isDisabled) {
      tokenManager.resetToken(token.id);
      resetCount++;
    }
  }
  
  res.json({ 
    success: true, 
    message: `Reset ${resetCount} disabled tokens`,
    resetCount
  });
});

// ============ Static Files (Frontend) ============

// Serve static files from dist directory
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handler
app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', _err);
  res.status(500).json({
    error: true,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📖 API: http://localhost:${PORT}/api/health`);
  console.log(`🎨 Frontend: http://localhost:${PORT}`);
});

export default app;
