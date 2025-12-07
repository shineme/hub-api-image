import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Key, 
  BarChart3, 
  Activity, 
  RefreshCw, 
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { tokenManager } from '../services/tokenManager';
import { HFToken, TokenStats } from '../types/tokenTypes';

const ADMIN_PASSWORD = 'affadsense';
const ADMIN_AUTH_KEY = 'admin_authenticated';

interface TokenWithStats extends HFToken {
  stats: TokenStats;
}

export const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tokens, setTokens] = useState<TokenWithStats[]>([]);
  const [activeTab, setActiveTab] = useState<'tokens' | 'stats' | 'api'>('tokens');
  
  // Token form state
  const [newToken, setNewToken] = useState('');
  const [newTokenName, setNewTokenName] = useState('');
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Check if already authenticated
    const auth = sessionStorage.getItem(ADMIN_AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTokens();
    }
  }, [isAuthenticated]);

  const loadTokens = () => {
    const allTokens = tokenManager.getTokens();
    const allStats = tokenManager.getAllTokenStats();
    
    const tokensWithStats: TokenWithStats[] = allTokens.map(token => ({
      ...token,
      stats: allStats[token.id] || {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        lastUsed: null,
        averageResponseTime: 0
      }
    }));
    
    setTokens(tokensWithStats);
  };

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
      setError('');
    } else {
      setError('密码错误');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    onClose();
  };

  const handleAddToken = () => {
    if (!newToken.trim()) return;
    
    const success = tokenManager.addToken(newToken.trim(), newTokenName.trim() || undefined);
    if (success) {
      setNewToken('');
      setNewTokenName('');
      loadTokens();
    } else {
      setError('令牌格式无效或已存在');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemoveToken = (tokenId: string) => {
    if (confirm('确定要删除此令牌吗？')) {
      tokenManager.removeToken(tokenId);
      loadTokens();
    }
  };

  const handleUpdateTokenName = (tokenId: string) => {
    tokenManager.updateToken(tokenId, { name: editName });
    setEditingToken(null);
    loadTokens();
  };

  const handleResetStats = (tokenId: string) => {
    tokenManager.resetTokenStats(tokenId);
    loadTokens();
  };

  const toggleShowToken = (tokenId: string) => {
    setShowTokens(prev => ({ ...prev, [tokenId]: !prev[tokenId] }));
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return '****';
    return token.substring(0, 4) + '****' + token.substring(token.length - 4);
  };

  const getTokenStatus = (token: TokenWithStats) => {
    if (token.isDisabled) {
      const remaining = token.disabledUntil ? token.disabledUntil - Date.now() : 0;
      if (remaining > 0) {
        return { status: 'disabled', label: `禁用中 (${Math.ceil(remaining / 60000)}分钟后恢复)`, color: 'text-red-400' };
      }
    }
    if (token.consecutiveFailures >= 3) {
      return { status: 'warning', label: '多次失败', color: 'text-yellow-400' };
    }
    return { status: 'active', label: '活跃', color: 'text-green-400' };
  };

  const getSuccessRate = (stats: TokenStats) => {
    if (stats.totalRequests === 0) return 0;
    return Math.round((stats.successCount / stats.totalRequests) * 100);
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '从未使用';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // Calculate overall stats
  const overallStats = tokens.reduce((acc, t) => ({
    totalRequests: acc.totalRequests + t.stats.totalRequests,
    successCount: acc.successCount + t.stats.successCount,
    failureCount: acc.failureCount + t.stats.failureCount,
    activeTokens: acc.activeTokens + (t.isDisabled ? 0 : 1),
    disabledTokens: acc.disabledTokens + (t.isDisabled ? 1 : 0)
  }), { totalRequests: 0, successCount: 0, failureCount: 0, activeTokens: 0, disabledTokens: 0 });

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-[#0D0B14] border border-white/10 rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white">后台管理</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">管理密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                placeholder="请输入管理密码"
                autoFocus
              />
            </div>
            
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
              >
                登录
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#0D0B14] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-white">后台管理</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTokens}
              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {[
            { id: 'tokens', label: '令牌管理', icon: Key },
            { id: 'stats', label: '调用统计', icon: BarChart3 },
            { id: 'api', label: 'API 文档', icon: Zap }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/5'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'tokens' && (
            <div className="space-y-6">
              {/* Add Token Form */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-sm font-medium text-white mb-3">添加新令牌</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="名称 (可选)"
                    className="w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <input
                    type="text"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="输入 Hugging Face Token (hf_...)"
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <button
                    onClick={handleAddToken}
                    disabled={!newToken.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    添加
                  </button>
                </div>
              </div>

              {/* Token List */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white/60">令牌列表 ({tokens.length})</h3>
                
                {tokens.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    暂无令牌，请添加 Hugging Face Token
                  </div>
                ) : (
                  tokens.map((token) => {
                    const status = getTokenStatus(token);
                    const successRate = getSuccessRate(token.stats);
                    
                    return (
                      <div
                        key={token.id}
                        className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Name & Status */}
                            <div className="flex items-center gap-2 mb-2">
                              {editingToken === token.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateTokenName(token.id)}
                                    className="p-1 text-green-400 hover:bg-green-500/10 rounded"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingToken(null)}
                                    className="p-1 text-white/40 hover:bg-white/10 rounded"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-medium text-white">
                                    {token.name || `Token ${token.id.slice(0, 8)}`}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingToken(token.id);
                                      setEditName(token.name || '');
                                    }}
                                    className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${status.color} bg-current/10`}>
                                {status.label}
                              </span>
                            </div>
                            
                            {/* Token Value */}
                            <div className="flex items-center gap-2 mb-3">
                              <code className="text-xs text-white/50 font-mono">
                                {showTokens[token.id] ? token.token : maskToken(token.token)}
                              </code>
                              <button
                                onClick={() => toggleShowToken(token.id)}
                                className="p-1 text-white/40 hover:text-white"
                              >
                                {showTokens[token.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                            
                            {/* Stats */}
                            <div className="flex flex-wrap gap-4 text-xs text-white/50">
                              <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                调用: {token.stats.totalRequests}
                              </span>
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                成功: {token.stats.successCount}
                              </span>
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" />
                                失败: {token.stats.failureCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                成功率: {successRate}%
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(token.stats.lastUsed)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResetStats(token.id)}
                              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              title="重置统计"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveToken(token.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                    <Activity className="w-4 h-4" />
                    总调用次数
                  </div>
                  <div className="text-2xl font-bold text-white">{overallStats.totalRequests}</div>
                </div>
                
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2 text-green-400/70 text-xs mb-2">
                    <CheckCircle className="w-4 h-4" />
                    成功次数
                  </div>
                  <div className="text-2xl font-bold text-green-400">{overallStats.successCount}</div>
                </div>
                
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2 text-red-400/70 text-xs mb-2">
                    <XCircle className="w-4 h-4" />
                    失败次数
                  </div>
                  <div className="text-2xl font-bold text-red-400">{overallStats.failureCount}</div>
                </div>
                
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2 text-purple-400/70 text-xs mb-2">
                    <TrendingUp className="w-4 h-4" />
                    总成功率
                  </div>
                  <div className="text-2xl font-bold text-purple-400">
                    {overallStats.totalRequests > 0 
                      ? Math.round((overallStats.successCount / overallStats.totalRequests) * 100) 
                      : 0}%
                  </div>
                </div>
              </div>

              {/* Token Status Overview */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-sm font-medium text-white mb-4">令牌状态概览</h3>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-white/70">活跃: {overallStats.activeTokens}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-white/70">禁用: {overallStats.disabledTokens}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/30"></div>
                    <span className="text-white/70">总计: {tokens.length}</span>
                  </div>
                </div>
              </div>

              {/* Per-Token Stats Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="pb-3 font-medium">令牌</th>
                      <th className="pb-3 font-medium text-center">状态</th>
                      <th className="pb-3 font-medium text-right">调用</th>
                      <th className="pb-3 font-medium text-right">成功</th>
                      <th className="pb-3 font-medium text-right">失败</th>
                      <th className="pb-3 font-medium text-right">成功率</th>
                      <th className="pb-3 font-medium text-right">平均响应</th>
                      <th className="pb-3 font-medium text-right">最后使用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token) => {
                      const status = getTokenStatus(token);
                      const successRate = getSuccessRate(token.stats);
                      
                      return (
                        <tr key={token.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 text-white">
                            {token.name || maskToken(token.token)}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`text-xs px-2 py-1 rounded-full ${status.color} bg-current/10`}>
                              {status.status === 'active' ? '●' : status.status === 'disabled' ? '○' : '◐'}
                            </span>
                          </td>
                          <td className="py-3 text-right text-white/70">{token.stats.totalRequests}</td>
                          <td className="py-3 text-right text-green-400">{token.stats.successCount}</td>
                          <td className="py-3 text-right text-red-400">{token.stats.failureCount}</td>
                          <td className="py-3 text-right">
                            <span className={successRate >= 80 ? 'text-green-400' : successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                              {successRate}%
                            </span>
                          </td>
                          <td className="py-3 text-right text-white/50">
                            {token.stats.averageResponseTime > 0 
                              ? `${(token.stats.averageResponseTime / 1000).toFixed(1)}s` 
                              : '-'}
                          </td>
                          <td className="py-3 text-right text-white/50 text-xs">
                            {token.stats.lastUsed 
                              ? new Date(token.stats.lastUsed).toLocaleTimeString('zh-CN')
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <h3 className="text-purple-400 font-medium mb-2">前端 API 调用说明</h3>
                <p className="text-white/60 text-sm">
                  本应用提供图片生成和 4K 放大功能，以下是前端调用方式。
                </p>
              </div>

              {/* Generate Image API */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  生成图片 - generateImage
                </h4>
                <pre className="bg-black/30 p-4 rounded-lg text-sm overflow-x-auto">
                  <code className="text-green-400">{`import { generateImage } from './services/hfService';

// 调用示例
const result = await generateImage(
  'z-image-turbo',    // model: 'z-image-turbo' | 'qwen-image-fast'
  'A beautiful sunset', // prompt: 图片描述
  '16:9',              // aspectRatio: 宽高比
  12345,               // seed: 随机种子 (可选)
  true                 // enableHD: 是否启用高清 (可选)
);

// 返回结果
{
  id: string,          // 唯一ID
  url: string,         // 图片URL
  model: string,       // 使用的模型
  prompt: string,      // 提示词
  aspectRatio: string, // 宽高比
  timestamp: number,   // 时间戳
  seed: number         // 使用的种子
}`}</code>
                </pre>
              </div>

              {/* Upscaler API */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  4K 放大 - upscaler
                </h4>
                <pre className="bg-black/30 p-4 rounded-lg text-sm overflow-x-auto">
                  <code className="text-green-400">{`import { upscaler } from './services/hfService';

// 调用示例
const result = await upscaler(
  'https://example.com/image.jpg', // url: 图片URL
  { width: 1024, height: 768 }     // currentResolution: 当前分辨率 (可选)
);

// 返回结果
{
  url: string,         // 放大后的图片URL
  isAlready4K?: boolean // 如果已经是4K则返回true
}`}</code>
                </pre>
              </div>

              {/* Optimize Prompt API */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  优化提示词 - optimizePrompt
                </h4>
                <pre className="bg-black/30 p-4 rounded-lg text-sm overflow-x-auto">
                  <code className="text-green-400">{`import { optimizePrompt } from './services/hfService';

// 调用示例
const optimized = await optimizePrompt('A cat');

// 返回优化后的提示词字符串`}</code>
                </pre>
              </div>

              {/* Parameters Reference */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-white font-medium mb-3">参数说明</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-purple-400 font-mono">model</span>
                    <span className="text-white/50 ml-2">模型选择</span>
                    <ul className="mt-1 ml-4 text-white/60">
                      <li>• <code className="text-yellow-400">z-image-turbo</code> - 快速生成，支持 HD 模式</li>
                      <li>• <code className="text-yellow-400">qwen-image-fast</code> - Qwen 图像模型</li>
                    </ul>
                  </div>
                  
                  <div>
                    <span className="text-purple-400 font-mono">aspectRatio</span>
                    <span className="text-white/50 ml-2">宽高比选项</span>
                    <div className="mt-1 ml-4 text-white/60 flex flex-wrap gap-2">
                      {['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5'].map(r => (
                        <code key={r} className="text-yellow-400 bg-yellow-400/10 px-1 rounded">{r}</code>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-purple-400 font-mono">seed</span>
                    <span className="text-white/50 ml-2">随机种子 (可选)</span>
                    <p className="mt-1 ml-4 text-white/60">相同种子 + 相同参数 = 相同图片</p>
                  </div>
                  
                  <div>
                    <span className="text-purple-400 font-mono">enableHD</span>
                    <span className="text-white/50 ml-2">高清模式 (仅 z-image-turbo)</span>
                    <p className="mt-1 ml-4 text-white/60">启用后生成更高分辨率图片</p>
                  </div>
                </div>
              </div>

              {/* Error Handling */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  错误处理
                </h4>
                <pre className="bg-black/30 p-4 rounded-lg text-sm overflow-x-auto">
                  <code className="text-green-400">{`import { APIError, ErrorCode } from './types/tokenTypes';

try {
  const result = await generateImage(...);
} catch (error) {
  if (error instanceof APIError) {
    switch (error.code) {
      case ErrorCode.INVALID_PARAMS:
        // 参数无效
        break;
      case ErrorCode.TOKEN_QUOTA_EXCEEDED:
        // 配额耗尽
        break;
      case ErrorCode.ALL_TOKENS_FAILED:
        // 所有令牌失败
        break;
      case ErrorCode.GENERATION_FAILED:
        // 生成失败
        break;
    }
  }
}`}</code>
                </pre>
              </div>

              {/* Token Management Note */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  令牌说明
                </h4>
                <ul className="text-white/60 text-sm space-y-1">
                  <li>• 令牌在后台管理页面配置，前端调用时自动轮询</li>
                  <li>• 单个令牌失败会自动切换到下一个令牌</li>
                  <li>• 连续失败 3 次的令牌会被临时禁用 5 分钟</li>
                  <li>• 无令牌时使用公共配额（有限制）</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
