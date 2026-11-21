/**
 * Storage 模組
 * 
 * 管理 localStorage 持久化，包含儲存、載入、清除與版本遷移功能。
 * 支援正常模式與演示模式的資料隔離（使用不同的 localStorage key）。
 */

import type { AppState } from './state-machine.js';
import type { CodexState } from './codex-manager.js';

/**
 * 使用者設定介面（目前暫無設定項目，保留供未來擴充）
 */
export interface UserSettings {
  // 未來可能的設定：音效、語言等
}

/**
 * 儲存的資料結構
 */
export interface StoredData {
  version: number; // 資料版本號（用於未來遷移）
  totalDepth: number; // 累積總深度 (m)
  completedRounds: number; // 已完成輪數
  endingSeen: boolean; // 是否已經看過 ENDING 狀態
  codex: CodexState; // 圖鑑狀態
  settings: UserSettings; // 使用者設定
  currentState: {
    state: AppState; // 當前狀態
    roundStartAt: number | null; // 本輪開始時間戳 (ms)
    lastSeenAt: number | null; // 最後確認使用者在線的時間戳 (ms)
    hiddenAt: number | null; // 分頁隱藏時的時間戳 (ms)
    selectedDurationMs: number | null; // 選定的專注時長 (ms)
    distractionPenaltyMs: number; // 本輪累積的分心懲罰時間 (ms)
    roundStartDepth: number; // 本輪開始時的深度 (m)
    roundDescentDepth: number; // 本輪下沉深度 (m)
    roundRisePenalty: number; // 本輪累積上浮懲罰 (m)
  };
}

/**
 * Storage 介面
 */
export interface Storage {
  /**
   * 儲存資料到 localStorage
   * @param data 要儲存的資料
   * @param isDemoMode 是否為演示模式
   */
  save(data: StoredData, isDemoMode: boolean): void;

  /**
   * 從 localStorage 載入資料
   * @param isDemoMode 是否為演示模式
   * @returns 載入的資料，若不存在或格式無效則回傳 null
   */
  load(isDemoMode: boolean): StoredData | null;

  /**
   * 清除指定模式的資料
   * @param isDemoMode 是否為演示模式
   */
  clear(isDemoMode: boolean): void;

  /**
   * 清除所有資料（正常模式與演示模式）
   */
  clearAll(): void;
}

// localStorage key 常數
const STORAGE_KEY = 'deep-sea-focus';
const DEMO_STORAGE_KEY = 'demo_deep-sea-focus';

// 當前資料版本號
const CURRENT_VERSION = 1;

/**
 * Storage 實作類別
 */
class StorageImpl implements Storage {
  save(data: StoredData, isDemoMode: boolean): void {
    const key = this.getStorageKey(isDemoMode);
    
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      // 不拋出錯誤，讓應用程式繼續運行
    }
  }

  load(isDemoMode: boolean): StoredData | null {
    const key = this.getStorageKey(isDemoMode);
    
    try {
      const json = localStorage.getItem(key);
      
      // 沒有資料
      if (!json) {
        return null;
      }
      
      // 解析 JSON
      const data = JSON.parse(json) as StoredData;
      
      // 版本檢查
      if (data.version !== CURRENT_VERSION) {
        console.warn(
          `Data version mismatch: expected ${CURRENT_VERSION}, got ${data.version}. Attempting migration...`
        );
        return this.migrateData(data);
      }
      
      // 基本格式驗證
      if (!this.isValidStoredData(data)) {
        console.error('Invalid data format, ignoring stored data');
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      // 格式無效時回傳 null，使用預設值
      return null;
    }
  }

  clear(isDemoMode: boolean): void {
    const key = this.getStorageKey(isDemoMode);
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear all localStorage:', error);
    }
  }

  /**
   * 取得對應模式的 localStorage key
   */
  private getStorageKey(isDemoMode: boolean): string {
    return isDemoMode ? DEMO_STORAGE_KEY : STORAGE_KEY;
  }

  /**
   * 資料遷移邏輯（未來版本變更時使用）
   * 目前版本 1，尚無遷移需求
   * @param data 舊版本資料
   * @returns 遷移後的資料，若無法遷移則回傳 null
   */
  private migrateData(data: any): StoredData | null {
    // 未來實作遷移邏輯
    // 例如：從版本 1 遷移到版本 2
    // if (data.version === 1) {
    //   return this.migrateFromV1ToV2(data);
    // }
    
    // 目前無法遷移，回傳 null 表示使用預設值
    console.warn('Unable to migrate data from version', data.version);
    return null;
  }

  /**
   * 驗證資料格式是否有效
   */
  private isValidStoredData(data: any): data is StoredData {
    // 檢查必要欄位是否存在
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    // 檢查版本號
    if (typeof data.version !== 'number') {
      return false;
    }

    // 檢查基本數值欄位
    if (typeof data.totalDepth !== 'number' ||
        typeof data.completedRounds !== 'number' ||
        typeof data.endingSeen !== 'boolean') {
      return false;
    }

    // 檢查 codex
    if (!data.codex || !Array.isArray(data.codex.unlockedCards)) {
      return false;
    }

    // 檢查 settings
    if (typeof data.settings !== 'object' || data.settings === null) {
      return false;
    }

    // 檢查 currentState
    if (!data.currentState || typeof data.currentState !== 'object') {
      return false;
    }

    const cs = data.currentState;
    if (typeof cs.state !== 'string' ||
        typeof cs.distractionPenaltyMs !== 'number' ||
        typeof cs.roundStartDepth !== 'number' ||
        typeof cs.roundDescentDepth !== 'number' ||
        typeof cs.roundRisePenalty !== 'number') {
      return false;
    }

    // 通過基本驗證
    return true;
  }
}

// 匯出單例
export const storage: Storage = new StorageImpl();
