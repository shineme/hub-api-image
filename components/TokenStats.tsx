import React, { useState, useEffect } from 'react';
import { tokenManager } from '../services/tokenManager';
import { TokenStats, HFToken } from '../types/tokenTypes';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

export const TokenStatsComponent: React.FC = () => {
  const [tokens, setTokens] = useState<HFToken[]>([]);
  const [stats, setStats] = useState<TokenStats[]>([]);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setTokens(tokenManager.getTokens());
    setStats(tokenManager.getAllTokenStats());
  };

  const formatTime = (timestamp: number): string => {
    if (!timestamp) return '从未使用';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString();
  };

  const formatResponseTime = (ms: number): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getTokenStats = (tokenId: string): TokenStats | undefined => {
    return stats.find(s => s.tokenId === tokenId);
  };

  const getSuccessRate = (stat: TokenStats): number => {
    if (stat.usageCount === 0) return 0;
    return Math.round((stat.successCount / stat.usageCount) * 100);
  };

  if (tokens.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>暂无令牌统计数据</p>
        <p className="text-sm mt-1">添加令牌后将显示使用统计</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{tokens.length}</div>
          <div className="text-xs text-white/50">令牌总数</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {tokens.filter(t => t.status === 'active').length}
          </div>
          <div className="text-xs text-white/50">活跃令牌</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {stats.reduce((sum, s) => sum + s.usageCount, 0)}
          </div>
          <div className="text-xs text-white/50">总调用次数</div>
        </div>
      </div>

      {/* Token Details */}
      <div className="space-y-2">
        {tokens.map((token, index) => {
          const stat = getTokenStats(token.id);
          const successRate = stat ? getSuccessRate(stat) : 0;
          
          return (
            <div
              key={token.id}
              className="bg-white/5 border border-white/10 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">令牌 #{index + 1}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    token.status === 'active' 
                      ? 'bg-green-500/20 text-green-400'
                      : token.status === 'quota_exceeded'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {token.status === 'active' ? '活跃' : 
                     token.status === 'quota_exceeded' ? '配额耗尽' : '已禁用'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    tokenManager.resetTokenStats(token.id);
                    loadData();
                  }}
                  className="p-1 text-white/40 hover:text-white/80 transition-colors"
                  title="重置统计"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <div>
                    <div className="text-white/80">{stat?.usageCount || 0}</div>
                    <div className="text-white/40">调用次数</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  <div>
                    <div className="text-white/80">{stat?.successCount || 0}</div>
                    <div className="text-white/40">成功</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <div>
                    <div className="text-white/80">{stat?.failureCount || 0}</div>
                    <div className="text-white/40">失败</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <div>
                    <div className="text-white/80">{formatResponseTime(stat?.averageResponseTime || 0)}</div>
                    <div className="text-white/40">平均响应</div>
                  </div>
                </div>
              </div>

              {/* Success Rate Bar */}
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/40">成功率</span>
                  <span className="text-white/60">{successRate}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      successRate >= 80 ? 'bg-green-500' :
                      successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              </div>

              {/* Last Used */}
              <div className="mt-2 text-xs text-white/40">
                最后使用: {formatTime(stat?.lastUsed || 0)}
              </div>

              {/* Disabled Until */}
              {token.disabledUntil && token.disabledUntil > Date.now() && (
                <div className="mt-2 text-xs text-yellow-400">
                  将在 {Math.ceil((token.disabledUntil - Date.now()) / 60000)} 分钟后恢复
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
