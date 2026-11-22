/**
 * Timer 模組
 * 
 * 計算已流逝時間與剩餘時間,使用時間戳驅動的計時機制確保準確性。
 * 支援分心懲罰、Demo 模式加速、以及 lastSeenAt 追蹤。
 */

import { Config } from './config';

export interface TimerState {
  roundStartAt: number; // 時間戳 (ms)
  selectedDurationMs: number; // 選定時長 (ms)
  lastSeenAt: number; // 最後確認使用者在線的時間戳 (ms)
  hiddenAt: number | null; // 分頁隱藏時的時間戳 (ms)
  distractionPenaltyMs: number; // 本輪累積的分心懲罰時間 (ms)
  isDemoMode: boolean;
}

export interface Timer {
  // 初始化
  start(durationMinutes: number, isDemoMode: boolean): TimerState;
  
  // 計算時間
  getElapsedFocusedTime(state: TimerState, nowMs: number): number; // 已專注時間 (ms)
  getRemainingTime(state: TimerState, nowMs: number): number; // 剩餘時間 (ms)
  
  // 分心處理
  markHidden(state: TimerState, nowMs: number): TimerState;
  markVisible(state: TimerState, nowMs: number): { state: TimerState; hiddenRealMs: number; hiddenDuration: number };
  applyDistractionPenalty(state: TimerState, penaltyMs: number): TimerState;
  
  // lastSeenAt 更新
  updateLastSeen(state: TimerState, nowMs: number): TimerState;
  
  // 完成檢查
  isComplete(state: TimerState, nowMs: number): boolean;
}

class TimerImpl implements Timer {
  /**
   * 初始化 TimerState
   * @param durationMinutes 選定的專注時長（分鐘）
   * @param isDemoMode 是否為演示模式
   */
  start(durationMinutes: number, isDemoMode: boolean): TimerState {
    const nowMs = Date.now();
    return {
      roundStartAt: nowMs,
      selectedDurationMs: durationMinutes * 60 * 1000,
      lastSeenAt: nowMs,
      hiddenAt: null,
      distractionPenaltyMs: 0,
      isDemoMode
    };
  }

  /**
   * 計算已專注時間
   * 
   * 公式: (當前時間 - 開始時間) × 倍率 - 分心懲罰時間 - 當前隱藏時段
   * 
   * 重要邏輯：
   * - 使用時間戳差值確保分頁節流時計時仍準確
   * - Demo 模式下時間加速 60 倍
   * - 隱藏時段不計入專注時間（實時排除）
   * - 分心懲罰累積記錄（已觸發的分心事件）
   * 
   * @param state TimerState
   * @param nowMs 當前時間戳 (ms)
   * @returns 已專注時間 (ms)，永遠非負
   */
  getElapsedFocusedTime(state: TimerState, nowMs: number): number {
    const multiplier = state.isDemoMode ? Config.demoModeMultiplier : 1;
    let elapsed = (nowMs - state.roundStartAt) * multiplier;
    
    // 減去分心懲罰
    elapsed -= state.distractionPenaltyMs;
    
    // 減去當前隱藏時段（如果隱藏中）
    if (state.hiddenAt !== null) {
      elapsed -= (nowMs - state.hiddenAt) * multiplier;
    }
    
    return Math.max(0, elapsed);
  }

  /**
   * 計算剩餘時間
   * 公式: 選定時長 - 已專注時間
   * @param state TimerState
   * @param nowMs 當前時間戳 (ms)
   * @returns 剩餘時間 (ms)，永遠非負
   */
  getRemainingTime(state: TimerState, nowMs: number): number {
    const focused = this.getElapsedFocusedTime(state, nowMs);
    return Math.max(0, state.selectedDurationMs - focused);
  }

  /**
   * 標記分頁隱藏
   * @param state TimerState
   * @param nowMs 當前時間戳 (ms)
   * @returns 新的 TimerState
   */
  markHidden(state: TimerState, nowMs: number): TimerState {
    return {
      ...state,
      hiddenAt: nowMs
    };
  }

  /**
   * 標記分頁顯示
   * @param state TimerState
   * @param nowMs 當前時間戳 (ms)
   * @returns 新的 TimerState、真實隱藏時長、以及加速後的隱藏時長
   */
  markVisible(state: TimerState, nowMs: number): { state: TimerState; hiddenRealMs: number; hiddenDuration: number } {
    if (state.hiddenAt === null) {
      // 沒有隱藏記錄，回傳 0
      return { state, hiddenRealMs: 0, hiddenDuration: 0 };
    }
    
    const hiddenRealMs = nowMs - state.hiddenAt; // 真實時間（未加速）
    const multiplier = state.isDemoMode ? Config.demoModeMultiplier : 1;
    const hiddenDuration = hiddenRealMs * multiplier; // 加速後的時間
    
    return {
      state: {
        ...state,
        hiddenAt: null
      },
      hiddenRealMs,
      hiddenDuration
    };
  }

  /**
   * 套用分心懲罰（將隱藏時間加入懲罰）
   * @param state TimerState
   * @param penaltyMs 懲罰時間 (ms)
   * @returns 新的 TimerState
   */
  applyDistractionPenalty(state: TimerState, penaltyMs: number): TimerState {
    return {
      ...state,
      distractionPenaltyMs: state.distractionPenaltyMs + penaltyMs
    };
  }

  /**
   * 更新 lastSeenAt 時間戳
   * 用於追蹤使用者最後在線時間，關頁重開時計算保留深度
   * @param state TimerState
   * @param nowMs 當前時間戳 (ms)
   * @returns 新的 TimerState
   */
  updateLastSeen(state: TimerState, nowMs: number): TimerState {
    return {
      ...state,
      lastSeenAt: nowMs
    };
  }

  /**
   * 檢查是否完成
   * @param state TimerState
   * @param nowMs 當前時間戳 (ms)
   * @returns 是否完成（剩餘時間 <= 0）
   */
  isComplete(state: TimerState, nowMs: number): boolean {
    return this.getRemainingTime(state, nowMs) <= 0;
  }
}

// 匯出單例實例
export const timer: Timer = new TimerImpl();
