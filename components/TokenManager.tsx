import React, { useState, useEffect } from 'react';
import { tokenManager } from '../services/tokenManager';
import { HFToken } from '../types/tokenTypes';
import { Plus, Trash2, Edit2, Check, X, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface TokenManagerProps {
  onTokensChange?: () => void;
}

export const TokenManagerComponent: React.FC<TokenManagerProps> = ({ onTokensChange }) => {
  const [tokens, setTokens] = useState<HFToken[]>([]);
  const [newToken, setNewToken] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = () => {
    setTokens(tokenManager.getTokens());
  };

  const maskToken = (token: string): string => {
    if (token.length <= 8) return '****';
    return `${token.slice(0, 4)}${'*'.repeat(Math.min(token.length - 8, 20))}${token.slice(-4)}`;
  };

  const handleAddToken = async () => {
    if (!newToken.trim()) return;
    
    setError(null);
    try {
      await tokenManager.addToken(newToken);
      setNewToken('');
      loadTokens();
      onTokensChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to add token');
    }
  };

  const handleRemoveToken = (tokenId: string) => {
    try {
      tokenManager.removeToken(tokenId);
      loadTokens();
      onTokensChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to remove token');
    }
  };

  const handleStartEdit = (token: HFToken) => {
    setEditingId(token.id);
    setEditValue(token.token);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editValue.trim()) return;
    
    setError(null);
    try {
      tokenManager.updateToken(editingId, editValue);
      setEditingId(null);
      setEditValue('');
      loadTokens();
      onTokensChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update token');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const toggleShowToken = (tokenId: string) => {
    setShowTokens(prev => ({
      ...prev,
      [tokenId]: !prev[tokenId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'disabled': return 'bg-red-500/20 text-red-400';
      case 'quota_exceeded': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '活跃';
      case 'disabled': return '已禁用';
      case 'quota_exceeded': return '配额耗尽';
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Token Form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
          placeholder="输入 Hugging Face Token (hf_...)"
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
        />
        <button
          onClick={handleAddToken}
          disabled={!newToken.trim()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Token List */}
      <div className="space-y-2">
        {tokens.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <p>暂无令牌</p>
            <p className="text-sm mt-1">添加 Hugging Face Token 以获得更高的 API 配额</p>
          </div>
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg"
            >
              {editingId === token.id ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-white/80 text-sm font-mono truncate">
                        {showTokens[token.id] ? token.token : maskToken(token.token)}
                      </code>
                      <button
                        onClick={() => toggleShowToken(token.id)}
                        className="p-1 text-white/40 hover:text-white/80 transition-colors"
                      >
                        {showTokens[token.id] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(token.status)}`}>
                        {getStatusText(token.status)}
                      </span>
                      <span className="text-white/40 text-xs">
                        使用 {token.usageCount} 次
                      </span>
                      {token.disabledUntil && token.disabledUntil > Date.now() && (
                        <span className="text-yellow-400 text-xs">
                          {Math.ceil((token.disabledUntil - Date.now()) / 60000)} 分钟后恢复
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartEdit(token)}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveToken(token.id)}
                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-white/40 space-y-1">
        <p>• 支持添加多个令牌,系统会自动轮询使用</p>
        <p>• 当某个令牌失败时,会自动切换到下一个令牌</p>
        <p>• 连续失败 3 次的令牌会被临时禁用 5 分钟</p>
      </div>
    </div>
  );
};
