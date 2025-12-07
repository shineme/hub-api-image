import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { tokenManager } from './tokenManager.js';
import { generateImageAPI, upscaleImageAPI, optimizePromptAPI } from './apiHandlers.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    tokenCount: tokenManager.getTokens().length
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
      name: t.name,
      isDisabled: t.isDisabled,
      consecutiveFailures: t.consecutiveFailures,
      ...stats[t.id]
    }))
  });
});

/**
 * POST /api/tokens
 * Add a new token (requires admin password)
 */
app.post('/api/tokens', adminAuth, (req: Request, res: Response) => {
  const { token, name } = req.body;
  
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

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: true,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running at http://localhost:${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api/health`);
});

export default app;
