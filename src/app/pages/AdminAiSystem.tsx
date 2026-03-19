import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import {
  Bot, Key, Eye, EyeOff, Save, CheckCircle2, XCircle, Loader2,
  Sparkles, Zap, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';

type AiModel = 'gemini' | 'grok';

interface AiSettings {
  active_model: AiModel;
  gemini_api_key: string;
  grok_api_key: string;
  system_prompt: string;
  gemini_status: 'operational' | 'failing';
  grok_status: 'operational' | 'failing';
  last_error: string | null;
  last_error_at: string | null;
}

interface SaveStatus {
  type: 'idle' | 'saving' | 'success' | 'error';
  message: string;
}

const MODEL_INFO = {
  gemini: {
    id: 'gemini' as AiModel,
    name: 'Google Gemini',
    tagline: 'Gemini 2.5 Flash',
    description: 'Powered by Google DeepMind. Best for nuanced legal conversations and multi-turn reasoning.',
    icon: Sparkles,
    iconColor: 'text-blue-500',
    borderActive: 'border-blue-500',
    bgActive: 'bg-blue-50',
    badgeBg: 'bg-blue-100 text-blue-700',
    keyPlaceholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  grok: {
    id: 'grok' as AiModel,
    name: 'xAI Grok',
    tagline: 'Grok-3',
    description: 'Powered by xAI. Highly capable model with real-time knowledge and strong reasoning.',
    icon: Zap,
    iconColor: 'text-violet-500',
    borderActive: 'border-violet-500',
    bgActive: 'bg-violet-50',
    badgeBg: 'bg-violet-100 text-violet-700',
    keyPlaceholder: 'xai-...',
    docsUrl: 'https://console.x.ai/',
  },
};

export function AdminAiSystem() {
  const [settings, setSettings] = useState<AiSettings>({
    active_model: 'gemini',
    gemini_api_key: '',
    grok_api_key: '',
    system_prompt: '',
    gemini_status: 'operational',
    grok_status: 'operational',
    last_error: null,
    last_error_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ type: 'idle', message: '' });
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'syncing' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [showKeys, setShowKeys] = useState<{ gemini: boolean; grok: boolean }>({ gemini: false, grok: false });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/ai-settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSettings({
        active_model: data.active_model || 'gemini',
        gemini_api_key: data.gemini_api_key || '',
        grok_api_key: data.grok_api_key || '',
        system_prompt: data.system_prompt || '',
        gemini_status: data.gemini_status || 'operational',
        grok_status: data.grok_status || 'operational',
        last_error: data.last_error || null,
        last_error_at: data.last_error_at || null,
      });
    } catch {
      // silently fail, empty defaults are fine
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setSaveStatus({ type: 'saving', message: '' });
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      setSaveStatus({ type: 'success', message: 'Settings saved successfully. The chatbot will now use the selected model.' });
      setTimeout(() => setSaveStatus({ type: 'idle', message: '' }), 4000);
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Could not save settings. Please try again.' });
      setTimeout(() => setSaveStatus({ type: 'idle', message: '' }), 5000);
    }
  };

  const handleSyncPinecone = async () => {
    setSyncStatus({ type: 'syncing', message: 'Syncing lawyers to Pinecone...' });
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/sync-pinecone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log(data);
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      setSyncStatus({ type: 'success', message: data.message || 'Sync successful!' });
      setTimeout(() => setSyncStatus({ type: 'idle', message: '' }), 4000);
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: err.message || 'Failed to sync to Pinecone' });
    }
  };

  const activeKeyForSelectedModel = settings.active_model === 'gemini'
    ? settings.gemini_api_key
    : settings.grok_api_key;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-slate-800 flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            AI System Configuration
          </h1>
          <p className="text-slate-500 mt-2">
            Select the AI model powering the chatbot and configure API keys. Keys are stored securely and never exposed to end users.
          </p>
        </div>
        <Button
          onClick={fetchSettings}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 text-slate-600"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8 max-w-3xl">

          {/* ── Model Selector ── */}
          <div className="bg-white rounded-[16px] border border-slate-200 shadow-[0px_8px_24px_rgba(15,23,42,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Bot className="w-5 h-5 text-slate-500" />
              Active AI Model
            </h2>
            <p className="text-[13px] text-slate-500 mb-5">
              This is the model the chatbot will use for all user conversations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.values(MODEL_INFO) as typeof MODEL_INFO['gemini'][]).map((model) => {
                const isActive = settings.active_model === model.id;
                const Icon = model.icon;
                const hasKey = model.id === 'gemini' ? !!settings.gemini_api_key : !!settings.grok_api_key;
                const status = model.id === 'gemini' ? settings.gemini_status : settings.grok_status;
                const isFailing = status === 'failing';

                return (
                  <button
                    key={model.id}
                    onClick={() => setSettings(s => ({ ...s, active_model: model.id }))}
                    className={`relative p-5 rounded-[12px] border-2 text-left transition-all duration-200 block w-full
                      ${isActive ? `${model.borderActive} ${model.bgActive} shadow-sm` : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}
                      ${isFailing && isActive ? 'ring-2 ring-red-500/50' : ''}
                    `}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                        <Icon className={`w-5 h-5 ${model.iconColor}`} />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {isActive && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${model.badgeBg}`}>
                            ACTIVE
                          </span>
                        )}
                        {hasKey && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isFailing ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                              {isFailing ? 'FAILING' : 'OPERATIONAL'}
                            </span>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-slate-800 text-[15px]">{model.name}</h3>
                    <p className={`text-[12px] font-medium mt-0.5 mb-2 ${model.iconColor}`}>{model.tagline}</p>
                    <p className="text-[12px] text-slate-500 leading-relaxed">{model.description}</p>
                    
                    <div className="mt-3 flex items-center gap-1.5">
                      {hasKey ? (
                        <><Key className="w-3.5 h-3.5 text-slate-400" /><span className="text-[11px] text-slate-600 font-medium">API key configured</span></>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5 text-slate-400" /><span className="text-[11px] text-slate-400">No API key set</span></>
                      )}
                    </div>

                    {isFailing && settings.last_error && (
                        <div className="mt-3 bg-red-50 p-2 rounded text-[11px] text-red-600 border border-red-100">
                          <span className="font-semibold block mb-0.5">Last Error:</span>
                          <span className="line-clamp-2">{settings.last_error}</span>
                        </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── API Keys ── */}
          <div className="bg-white rounded-[16px] border border-slate-200 shadow-[0px_8px_24px_rgba(15,23,42,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Key className="w-5 h-5 text-slate-500" />
              API Keys
            </h2>
            <p className="text-[13px] text-slate-500 mb-6">
              Keys are encrypted at rest and only decrypted when the chatbot needs to make a request.
            </p>

            <div className="space-y-6">
              {(Object.values(MODEL_INFO) as typeof MODEL_INFO['gemini'][]).map((model) => {
                const keyField = model.id === 'gemini' ? 'gemini_api_key' : 'grok_api_key';
                const keyValue = settings[keyField];
                const isVisible = showKeys[model.id];
                const Icon = model.icon;

                return (
                  <div key={model.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-[14px] font-semibold text-slate-700">
                        <Icon className={`w-4 h-4 ${model.iconColor}`} />
                        {model.name} API Key
                      </label>
                      <a
                        href={model.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-[12px] font-medium ${model.iconColor} hover:underline`}
                      >
                        Get API Key ↗
                      </a>
                    </div>

                    <div className="relative">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={keyValue}
                        onChange={(e) => setSettings(s => ({ ...s, [keyField]: e.target.value }))}
                        placeholder={`Paste your ${model.name} key (${model.keyPlaceholder})`}
                        className="w-full h-11 pr-12 pl-4 rounded-[10px] border border-slate-200 bg-slate-50 text-[13px] font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys(prev => ({ ...prev, [model.id]: !isVisible }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                        title={isVisible ? 'Hide key' : 'Show key'}
                      >
                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {keyValue && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        Key saved — {keyValue.length} characters
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── System Prompt ── */}
          <div className="bg-white rounded-[16px] border border-slate-200 shadow-[0px_8px_24px_rgba(15,23,42,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Bot className="w-5 h-5 text-slate-500" />
              System Prompt
            </h2>
            <p className="text-[13px] text-slate-500 mb-6">
              This prompt dictates the persona, behavior, and constraints of the AI assistant for all users. Leave blank to use the default prompt.
            </p>

            <div className="space-y-4">
              <label className="text-[14px] font-semibold text-slate-700">
                Instructions & Context
              </label>
              <textarea
                value={settings.system_prompt}
                onChange={(e) => setSettings(s => ({ ...s, system_prompt: e.target.value }))}
                placeholder="You are a compassionate, expert Legal Guide..."
                className="w-full h-64 p-4 rounded-[10px] border border-slate-200 bg-slate-50 text-[13px] font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
              />
            </div>
          </div>

          {/* ── Active Config Summary ── */}
          <div className="bg-slate-50 rounded-[12px] border border-slate-200 p-5 flex items-start gap-4">
            <div className="mt-0.5">
              {activeKeyForSelectedModel ? (
                settings.active_model === 'gemini' ? (
                  settings.gemini_status === 'failing' ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  settings.grok_status === 'failing' ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />
                )
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-slate-800">
                {activeKeyForSelectedModel
                  ? (
                    (settings.active_model === 'gemini' ? settings.gemini_status : settings.grok_status) === 'failing'
                      ? `Action required — ${MODEL_INFO[settings.active_model].name} is failing`
                      : `Chatbot is ready — using ${MODEL_INFO[settings.active_model].name}`
                  )
                  : `Action required — no API key set for ${MODEL_INFO[settings.active_model].name}`}
              </p>
              <p className="text-[13px] text-slate-500 mt-1">
                {activeKeyForSelectedModel
                  ? `The chatbot will use the ${MODEL_INFO[settings.active_model].tagline} model for all user conversations. If it fails, it will attempt to fallback to the other model automatically. Save settings below to apply any changes or reset failure states.`
                  : `You have selected ${MODEL_INFO[settings.active_model].name} as the active model, but no API key has been configured. Please add the key above and save.`}
              </p>
            </div>
          </div>

          {/* ── Save Controls ── */}
          <div className="flex items-center justify-between">
            <div>
              {saveStatus.type === 'success' && (
                <div className="flex items-center gap-2 text-green-600 text-[14px] font-medium animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4" />
                  {saveStatus.message}
                </div>
              )}
              {saveStatus.type === 'error' && (
                <div className="flex items-center gap-2 text-red-500 text-[14px] font-medium animate-fadeIn">
                  <XCircle className="w-4 h-4" />
                  {saveStatus.message}
                </div>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saveStatus.type === 'saving'}
              className="bg-primary hover:bg-primary/90 text-white px-6 h-11 rounded-[10px] text-[14px] font-medium flex items-center gap-2 min-w-[140px] justify-center shadow-sm"
            >
              {saveStatus.type === 'saving' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> Save Settings</>
              )}
            </Button>
          </div>

          {/* ── Pinecone Vector DB Sync ── */}
          <div className="bg-white rounded-[16px] border border-slate-200 shadow-[0px_8px_24px_rgba(15,23,42,0.04)] p-6 mt-8">
            <h2 className="text-[16px] font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Bot className="w-5 h-5 text-slate-500" />
              Vector Database Sync (Pinecone)
            </h2>
            <p className="text-[13px] text-slate-500 mb-6 max-w-2xl">
              The AI Lawyer Recommendation system uses Pinecone to find the best lawyer matches for a user based on semantic similarity. New lawyers are automatically embedded when approved. Use this button to manually bulk-sync all currently approved lawyers to the vector database.
            </p>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleSyncPinecone}
                disabled={syncStatus.type === 'syncing'}
                variant="outline"
                className="border-primary/20 hover:bg-primary/5 text-primary px-6 h-10 rounded-[10px] text-[13px] font-medium flex items-center gap-2"
              >
                {syncStatus.type === 'syncing' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Syncing profiles...</>
                ) : (
                  <>Sync All Approved Lawyers</>
                )}
              </Button>

              {syncStatus.type === 'success' && (
                <div className="flex items-center gap-2 text-green-600 text-[13px] font-medium animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4" />
                  {syncStatus.message}
                </div>
              )}
              {syncStatus.type === 'error' && (
                <div className="flex items-center gap-2 text-red-500 text-[13px] font-medium animate-fadeIn">
                  <XCircle className="w-4 h-4" />
                  {syncStatus.message}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </AdminLayout>
  );
}
