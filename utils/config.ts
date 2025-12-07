import { HFSettings } from '../types/tokenTypes';

const SETTINGS_KEY = 'hf_settings';

export const DEFAULT_SETTINGS: HFSettings = {
  enableTokenRotation: true,
  maxRetries: 3,
  retryDelay: 2000,
  tokenDisableDuration: 5 * 60 * 1000, // 5 minutes
  requestTimeout: 30000 // 30 seconds
};

export function loadSettings(): HFSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<HFSettings>): void {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function validateSettings(settings: Partial<HFSettings>): boolean {
  if (settings.requestTimeout !== undefined) {
    if (settings.requestTimeout < 5000 || settings.requestTimeout > 120000) {
      return false;
    }
  }
  
  if (settings.tokenDisableDuration !== undefined) {
    if (settings.tokenDisableDuration < 60000 || settings.tokenDisableDuration > 3600000) {
      return false;
    }
  }
  
  if (settings.maxRetries !== undefined) {
    if (settings.maxRetries < 1 || settings.maxRetries > 10) {
      return false;
    }
  }
  
  return true;
}
