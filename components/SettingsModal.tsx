import React, { useState, useEffect } from 'react';
import { X, Save, Languages, Settings2 } from 'lucide-react';
import { Language } from '../translations';
import { tokenManager } from '../services/tokenManager';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
    setLang: (lang: Language) => void;
    t: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, lang, setLang, t }) => {
    const [settings, setSettings] = useState(tokenManager.getSettings());

    useEffect(() => {
        if (isOpen) {
            setSettings(tokenManager.getSettings());
        }
    }, [isOpen]);

    const handleSaveSettings = () => {
        tokenManager.updateSettings(settings);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#0D0B14] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400">
                            <Settings2 className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-bold text-white">{t.settings}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-6">
                        {/* Language Selector */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-white/90 mb-3">
                                <Languages className="w-4 h-4 text-purple-400" />
                                {t.language}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setLang('en')}
                                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                        lang === 'en'
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    English
                                </button>
                                <button
                                    onClick={() => setLang('zh')}
                                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                        lang === 'zh'
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    中文
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-white/5 w-full"></div>

                        {/* Token Rotation Toggle */}
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-white/90">
                                    {lang === 'zh' ? '启用令牌轮询' : 'Enable Token Rotation'}
                                </label>
                                <button
                                    onClick={() => setSettings(s => ({ ...s, enableTokenRotation: !s.enableTokenRotation }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        settings.enableTokenRotation ? 'bg-purple-600' : 'bg-white/10'
                                    }`}
                                >
                                    <span
                                        className={`${
                                            settings.enableTokenRotation ? 'translate-x-6' : 'translate-x-1'
                                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                    />
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-white/40">
                                {lang === 'zh' 
                                    ? '启用后,系统会自动轮询使用多个令牌' 
                                    : 'When enabled, the system will automatically rotate through multiple tokens'}
                            </p>
                        </div>

                        <div className="h-px bg-white/5 w-full"></div>

                        {/* Advanced Settings */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-white/90">
                                {lang === 'zh' ? '高级设置' : 'Advanced Settings'}
                            </h3>
                            
                            <div>
                                <label className="block text-xs text-white/60 mb-1">
                                    {lang === 'zh' ? '请求超时 (秒)' : 'Request Timeout (seconds)'}
                                </label>
                                <input
                                    type="number"
                                    value={settings.requestTimeout / 1000}
                                    onChange={(e) => setSettings(s => ({ ...s, requestTimeout: Number(e.target.value) * 1000 }))}
                                    min={10}
                                    max={120}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-white/60 mb-1">
                                    {lang === 'zh' ? '令牌禁用时长 (分钟)' : 'Token Disable Duration (minutes)'}
                                </label>
                                <input
                                    type="number"
                                    value={settings.tokenDisableDuration / 60000}
                                    onChange={(e) => setSettings(s => ({ ...s, tokenDisableDuration: Number(e.target.value) * 60000 }))}
                                    min={1}
                                    max={60}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>
                        </div>

                        {/* Info about token management */}
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <p className="text-xs text-purple-300">
                                {lang === 'zh' 
                                    ? '💡 令牌管理已移至后台管理页面，点击顶部盾牌图标进入' 
                                    : '💡 Token management has been moved to Admin Panel. Click the shield icon in the header.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleSaveSettings}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-lg transition-colors shadow-lg shadow-purple-900/20"
                    >
                        <Save className="w-4 h-4" />
                        {t.save}
                    </button>
                </div>
            </div>
        </div>
    );
};
