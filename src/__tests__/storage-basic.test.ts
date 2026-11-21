/**
 * Storage 模組基本驗證測試
 * 
 * 快速驗證 Storage 模組的核心功能是否正常運作
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../storage';
import type { StoredData } from '../storage';
import { AppState } from '../state-machine';

describe('Storage Module - Basic Verification', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      }
    };
  })();
  
  beforeEach(() => {
    // 重置 localStorage mock
    localStorageMock.clear();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  it('should save and load data successfully', () => {
    const testData: StoredData = {
      version: 1,
      totalDepth: 1234.5,
      completedRounds: 3,
      endingSeen: false,
      codex: {
        unlockedCards: [
          {
            cardId: 'moon-jellyfish',
            unlockedAt: 1732000000000,
            obtainedCount: 1
          }
        ]
      },
      settings: {},
      currentState: {
        state: AppState.IDLE,
        roundStartAt: null,
        lastSeenAt: null,
        hiddenAt: null,
        selectedDurationMs: null,
        distractionPenaltyMs: 0,
        roundStartDepth: 1234.5,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      }
    };

    // 儲存資料
    storage.save(testData, false);

    // 載入資料
    const loaded = storage.load(false);

    // 驗證
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.totalDepth).toBe(1234.5);
    expect(loaded?.completedRounds).toBe(3);
    expect(loaded?.endingSeen).toBe(false);
    expect(loaded?.codex.unlockedCards).toHaveLength(1);
    expect(loaded?.codex.unlockedCards[0]?.cardId).toBe('moon-jellyfish');
  });

  it('should use different keys for normal and demo mode', () => {
    const normalData: StoredData = {
      version: 1,
      totalDepth: 100,
      completedRounds: 1,
      endingSeen: false,
      codex: { unlockedCards: [] },
      settings: {},
      currentState: {
        state: AppState.IDLE,
        roundStartAt: null,
        lastSeenAt: null,
        hiddenAt: null,
        selectedDurationMs: null,
        distractionPenaltyMs: 0,
        roundStartDepth: 0,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      }
    };

    const demoData: StoredData = {
      ...normalData,
      totalDepth: 500,
      completedRounds: 5
    };

    // 儲存到不同模式
    storage.save(normalData, false);
    storage.save(demoData, true);

    // 載入並驗證隔離
    const loadedNormal = storage.load(false);
    const loadedDemo = storage.load(true);

    expect(loadedNormal?.totalDepth).toBe(100);
    expect(loadedNormal?.completedRounds).toBe(1);
    expect(loadedDemo?.totalDepth).toBe(500);
    expect(loadedDemo?.completedRounds).toBe(5);
  });

  it('should return null when no data exists', () => {
    const loaded = storage.load(false);
    expect(loaded).toBeNull();
  });

  it('should return null when data format is invalid', () => {
    // 直接設定無效的 JSON
    localStorageMock.setItem('deep-sea-focus', '{ invalid json');
    
    const loaded = storage.load(false);
    expect(loaded).toBeNull();
  });

  it('should clear specific mode data', () => {
    const testData: StoredData = {
      version: 1,
      totalDepth: 100,
      completedRounds: 1,
      endingSeen: false,
      codex: { unlockedCards: [] },
      settings: {},
      currentState: {
        state: AppState.IDLE,
        roundStartAt: null,
        lastSeenAt: null,
        hiddenAt: null,
        selectedDurationMs: null,
        distractionPenaltyMs: 0,
        roundStartDepth: 0,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      }
    };

    // 儲存到兩個模式
    storage.save(testData, false);
    storage.save(testData, true);

    // 清除正常模式
    storage.clear(false);

    // 驗證
    expect(storage.load(false)).toBeNull();
    expect(storage.load(true)).not.toBeNull();
  });

  it('should clear all data', () => {
    const testData: StoredData = {
      version: 1,
      totalDepth: 100,
      completedRounds: 1,
      endingSeen: false,
      codex: { unlockedCards: [] },
      settings: {},
      currentState: {
        state: AppState.IDLE,
        roundStartAt: null,
        lastSeenAt: null,
        hiddenAt: null,
        selectedDurationMs: null,
        distractionPenaltyMs: 0,
        roundStartDepth: 0,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      }
    };

    // 儲存到兩個模式
    storage.save(testData, false);
    storage.save(testData, true);

    // 清除所有
    storage.clearAll();

    // 驗證
    expect(storage.load(false)).toBeNull();
    expect(storage.load(true)).toBeNull();
  });

  it('should validate data format correctly', () => {
    // 測試缺少必要欄位的資料
    const invalidData = {
      version: 1,
      totalDepth: 100
      // 缺少其他必要欄位
    };

    localStorageMock.setItem('deep-sea-focus', JSON.stringify(invalidData));
    
    const loaded = storage.load(false);
    expect(loaded).toBeNull();
  });

  it('should handle version mismatch', () => {
    const oldVersionData = {
      version: 999, // 不存在的版本
      totalDepth: 100,
      completedRounds: 1,
      endingSeen: false,
      codex: { unlockedCards: [] },
      settings: {},
      currentState: {
        state: AppState.IDLE,
        roundStartAt: null,
        lastSeenAt: null,
        hiddenAt: null,
        selectedDurationMs: null,
        distractionPenaltyMs: 0,
        roundStartDepth: 0,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      }
    };

    localStorageMock.setItem('deep-sea-focus', JSON.stringify(oldVersionData));
    
    // 應該嘗試遷移但失敗，回傳 null
    const loaded = storage.load(false);
    expect(loaded).toBeNull();
  });
});
