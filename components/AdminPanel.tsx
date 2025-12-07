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

// API base URL - use relative path for same-origin requests
const API_BASE = '/api';

const ADMIN_PASSWORD = 'affadsense';
const ADMIN_AUTH_KEY = 'admin_authenticated';

interface TokenWithStats {
  id: string;
  token: string;
  name?: string;
  status: 'active' | 'disabled' | 'quota_exceeded';
  isDisabled: boolean;
  failureCount: number;
  consecutiveFailures: number;
  lastUsed: number;
  disabledUntil?: number;
  usageCount: number;
  totalRequests: number;
  successCount: number;
  averageResponseTime: number;
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
  const [batchMode, setBatchMode] = useState(false);
  const [batchTokens, setBatchTokens] = useState('');
  const [batchResult, setBatchResult] = useState<{ success: number; failed: number } | null>(null);

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

  const loadTokens = async () => {
    try {
      const response = await fetch(`${API_BASE}/tokens/stats`, {
        headers: { 'X-Admin-Password': ADMIN_PASSWORD }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load tokens');
      }
      
      const data = await response.json();
      
      const tokensWithStats: TokenWithStats[] = data.stats.map((item: any) => ({
        id: item.id,
        token: item.token || `hf_****${item.id.slice(-4)}`,
        name: item.name,
        status: item.isDisabled ? 'disabled' : 'active',
        isDisabled: item.isDisabled,
        failureCount: item.failureCount || 0,
        consecutiveFailures: item.consecutiveFailures || 0,
        lastUsed: item.lastUsed || 0,
        disabledUntil: item.disabledUntil,
        usageCount: item.totalRequests || 0,
        totalRequests: item.totalRequests || 0,
        successCount: item.successCount || 0,
        averageResponseTime: item.averageResponseTime || 0
      }));
      
      setTokens(tokensWithStats);
    } catch (error) {
      console.error('Failed to load tokens:', error);
      setError('加载令牌失败');
      setTimeout(() => setError(''), 3000);
    }
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

  const handleAddToken = async () => {
    if (!newToken.trim()) return;
    
    try {
      const response = await fetch(`${API_BASE}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': ADMIN_PASSWORD
        },
        body: JSON.stringify({
          token: newToken.trim(),
          name: newTokenName.trim() || undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.message || 'Failed to add token');
      }
      
      setNewToken('');
      setNewTokenName('');
      loadTokens();
    } catch (e: any) {
      setError(e.message || '令牌格式无效或已存在');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleBatchAdd = async () => {
    if (!batchTokens.trim()) return;
    
    // 按行分割，支持多种分隔符
    const lines = batchTokens
      .split(/[\n,;]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    try {
      const response = await fetch(`${API_BASE}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': ADMIN_PASSWORD
        },
        body: JSON.stringify({ tokens: lines })
      });
      
      const data = await response.json();
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const failedCount = data.results?.filter((r: any) => !r.success).length || 0;
      
      setBatchResult({ success: successCount, failed: failedCount });
      if (successCount > 0) {
        loadTokens();
        setBatchTokens('');
      }
    } catch (e) {
      setError('批量添加失败');
      setTimeout(() => setError(''), 3000);
    }
    
    setTimeout(() => setBatchResult(null), 5000);
  };

  const handleRemoveToken = async (tokenId: string) => {
    if (confirm('确定要删除此令牌吗？')) {
      try {
        const response = await fetch(`${API_BASE}/tokens/${tokenId}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': ADMIN_PASSWORD }
        });
        
        if (!response.ok) {
          throw new Error('Failed to remove token');
        }
        
        loadTokens();
      } catch (e) {
        setError('删除令牌失败');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleUpdateTokenName = (tokenId: string) => {
    // 前端 tokenManager 不支持更新名称，只能更新 token 值
    // 这里暂时只关闭编辑模式
    setEditingToken(null);
  };

  const handleResetStats = async (tokenId: string) => {
    try {
      // 重置单个令牌 - 服务端暂不支持单个重置，使用全部重置
      const response = await fetch(`${API_BASE}/tokens/reset`, {
        method: 'POST',
        headers: { 'X-Admin-Password': ADMIN_PASSWORD }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset token');
      }
      
      loadTokens();
    } catch (e) {
      setError('重置令牌失败');
      setTimeout(() => setError(''), 3000);
    }
  };

  const toggleShowToken = (tokenId: string) => {
    setShowTokens(prev => ({ ...prev, [tokenId]: !prev[tokenId] }));
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return '****';
    return token.substring(0, 4) + '****' + token.substring(token.length - 4);
  };

  const getTokenStatus = (token: TokenWithStats) => {
    if (token.isDisabled || token.status === 'disabled') {
      const remaining = token.disabledUntil ? token.disabledUntil - Date.now() : 0;
      if (remaining > 0) {
        return { status: 'disabled', label: `禁用中 (${Math.ceil(remaining / 60000)}分钟后恢复)`, color: 'text-red-400' };
      }
      return { status: 'disabled', label: '已禁用', color: 'text-red-400' };
    }
    if (token.status === 'quota_exceeded') {
      return { status: 'warning', label: '配额耗尽', color: 'text-yellow-400' };
    }
    if (token.consecutiveFailures >= 3) {
      return { status: 'warning', label: '多次失败', color: 'text-yellow-400' };
    }
    return { status: 'active', label: '活跃', color: 'text-green-400' };
  };

  const getSuccessRate = (token: TokenWithStats) => {
    if (token.totalRequests === 0) return 0;
    return Math.round((token.successCount / token.totalRequests) * 100);
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '从未使用';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // Calculate overall stats
  const overallStats = tokens.reduce((acc, t) => ({
    totalRequests: acc.totalRequests + (t.totalRequests || 0),
    successCount: acc.successCount + (t.successCount || 0),
    failureCount: acc.failureCount + (t.failureCount || 0),
    activeTokens: acc.activeTokens + (!t.isDisabled ? 1 : 0),
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white">添加令牌</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBatchMode(false)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        !batchMode ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      单个
                    </button>
                    <button
                      onClick={() => setBatchMode(true)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        batchMode ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      批量
                    </button>
                  </div>
                </div>
                
                {!batchMode ? (
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
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={batchTokens}
                      onChange={(e) => setBatchTokens(e.target.value)}
                      placeholder="每行一个令牌，或用逗号/分号分隔&#10;hf_token_111111&#10;hf_token_222222&#10;hf_token_333333"
                      className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">
                        支持换行、逗号、分号分隔
                      </span>
                      <button
                        onClick={handleBatchAdd}
                        disabled={!batchTokens.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        批量添加
                      </button>
                    </div>
                    {batchResult && (
                      <div className={`p-2 rounded-lg text-sm ${
                        batchResult.failed === 0 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        成功添加 {batchResult.success} 个令牌
                        {batchResult.failed > 0 && `，${batchResult.failed} 个失败（无效或已存在）`}
                      </div>
                    )}
                  </div>
                )}
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
                    const successRate = getSuccessRate(token);
                    
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
                                调用: {token.totalRequests}
                              </span>
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                成功: {token.successCount}
                              </span>
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" />
                                失败: {token.failureCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                成功率: {successRate}%
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(token.lastUsed)}
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
                      const successRate = getSuccessRate(token);
                      
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
                          <td className="py-3 text-right text-white/70">{token.totalRequests}</td>
                          <td className="py-3 text-right text-green-400">{token.successCount}</td>
                          <td className="py-3 text-right text-red-400">{token.failureCount}</td>
                          <td className="py-3 text-right">
                            <span className={successRate >= 80 ? 'text-green-400' : successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                              {successRate}%
                            </span>
                          </td>
                          <td className="py-3 text-right text-white/50">
                            {token.averageResponseTime > 0 
                              ? `${(token.averageResponseTime / 1000).toFixed(1)}s` 
                              : '-'}
                          </td>
                          <td className="py-3 text-right text-white/50 text-xs">
                            {token.lastUsed 
                              ? new Date(token.lastUsed).toLocaleTimeString('zh-CN')
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

              {/* curl Examples */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  curl 命令示例
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-white/70 text-sm mb-2">生成图片:</p>
                    <pre className="bg-black/30 p-3 rounded-lg text-xs overflow-x-auto">
                      <code className="text-cyan-400">{`curl -X POST http://localhost:3001/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A beautiful sunset", "model": "z-image-turbo", "aspectRatio": "16:9", "enableHD": true}'`}</code>
                    </pre>
                  </div>
                  
                  <div>
                    <p className="text-white/70 text-sm mb-2">4K 放大:</p>
                    <pre className="bg-black/30 p-3 rounded-lg text-xs overflow-x-auto">
                      <code className="text-cyan-400">{`curl -X POST http://localhost:3001/api/upscale \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/image.jpg", "width": 1024, "height": 768}'`}</code>
                    </pre>
                  </div>
                  
                  <div>
                    <p className="text-white/70 text-sm mb-2">优化提示词:</p>
                    <pre className="bg-black/30 p-3 rounded-lg text-xs overflow-x-auto">
                      <code className="text-cyan-400">{`curl -X POST http://localhost:3001/api/optimize-prompt \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A cat"}'`}</code>
                    </pre>
                  </div>
                  
                  <div>
                    <p className="text-white/70 text-sm mb-2">健康检查:</p>
                    <pre className="bg-black/30 p-3 rounded-lg text-xs overflow-x-auto">
                      <code className="text-cyan-400">{`curl http://localhost:3001/api/health`}</code>
                    </pre>
                  </div>
                  
                  <div>
                    <p className="text-white/70 text-sm mb-2">令牌统计 (需要管理密码):</p>
                    <pre className="bg-black/30 p-3 rounded-lg text-xs overflow-x-auto">
                      <code className="text-cyan-400">{`curl http://localhost:3001/api/tokens/stats \\
  -H "X-Admin-Password: your-password"`}</code>
                    </pre>
                  </div>
                  
                  <div>
                    <p className="text-white/70 text-sm mb-2">添加令牌 (需要管理密码):</p>
                    <pre className="bg-black/30 p-3 rounded-lg text-xs overflow-x-auto">
                      <code className="text-cyan-400">{`curl -X POST http://localhost:3001/api/tokens \\
  -H "X-Admin-Password: your-password" \\
  -H "Content-Type: application/json" \\
  -d '{"token": "hf_xxxxx", "name": "My Token"}'`}</code>
                    </pre>
                  </div>
                  
                  <div>
                    <p className="text-white/70 text-sm mb-2">删除令牌 (需要管理密码):</p>
                    <pre className="bg-black/30 p-3 rounded-lg text-xs overflow-x-auto">
                      <code className="text-cyan-400">{`curl -X DELETE http://localhost:3001/api/tokens/token-id \\
  -H "X-Admin-Password: your-password"`}</code>
                    </pre>
                  </div>
                </div>
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
