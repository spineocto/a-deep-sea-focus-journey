/**
 * Application Controller
 * 
 * 協調各模組、處理使用者操作與瀏覽器事件，驅動應用程式狀態更新。
 * 
 * 職責：
 * - 初始化各模組
 * - 處理使用者操作（開始專注、放棄、跳過休息等）
 * - 處理瀏覽器事件（visibilitychange、pagehide）
 * - 驅動 RAF loop 更新 UI
 * - 定期自動儲存
 */

import { AppState, StateMachine, createStateMachine } from './state-machine.js';
import { timer, type TimerState } from './timer.js';
import { createDepthCalculator, createInitialDepthState, type DepthState, type DepthCalculator } from './depth-calculator.js';
import { codexManager, type CodexState } from './codex-manager.js';
import { storage, type StoredData } from './storage.js';
import { demoMode } from './demo-mode.js';
import { distractionDetector } from './distraction-detector.js';
import { Config } from './config.js';

/**
 * 應用程式全域狀態
 */
export interface AppGlobalState {
  // 狀態機
  stateMachine: StateMachine;
  
  // 計時器狀態
  timerState: TimerState | null;
  
  // 深度狀態
  depthState: DepthState;
  
  // 圖鑑狀態
  codexState: CodexState;
  
  // 完成輪數
  completedRounds: number;
  
  // 是否已看過 ENDING
  endingSeen: boolean;
  
  // 演示模式
  isDemoMode: boolean;
}

/**
 * Application Controller 介面
 */
export interface AppController {
  // 初始化
  init(): void;
  
  // 取得當前狀態
  getState(): AppGlobalState;
  
  // 打包當前狀態為 StoredData
  getCurrentData(): StoredData;
  
  // 使用者操作
  handleStartFocus(durationMinutes: number): boolean;
  handleAbandonRound(): boolean;
  handleSkipBreak(): boolean;
  handleEndingConfirmed(): boolean;
  handleDiveAgain(): boolean;
  
  // 儲存與載入
  save(): void;
  restoreFromStorage(): void;
  
  // RAF loop（由外部呼叫）
  update(): void;
}

/**
 * Application Controller 實作
 */
export class AppControllerImpl implements AppController {
  // 模組實例
  private stateMachine: StateMachine;
  private depthCalculator: DepthCalculator;
  
  // 狀態
  private timerState: TimerState | null = null;
  private depthState: DepthState;
  private codexState: CodexState;
  private completedRounds = 0;
  private endingSeen = false;
  
  // DISTRACTED 狀態追蹤
  private distractedStartAt = 0;
  
  // BREAK 狀態追蹤
  private breakStartAt = 0;
  private breakDurationMs = 0;
  
  // 自動儲存追蹤
  private lastSaveTime = 0;
  
  constructor() {
    this.stateMachine = createStateMachine();
    this.depthCalculator = createDepthCalculator();
    this.depthState = createInitialDepthState();
    this.codexState = { unlockedCards: [] };
  }
  
  /**
   * 初始化：註冊事件監聽器、載入存檔
   */
  init(): void {
    // 載入存檔
    this.restoreFromStorage();
    
    // 註冊 Page Visibility API
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    
    // 註冊 pagehide 事件
    window.addEventListener('pagehide', () => this.handlePageHide());
  }
  
  /**
   * 取得當前狀態
   */
  getState(): AppGlobalState {
    return {
      stateMachine: this.stateMachine,
      timerState: this.timerState,
      depthState: this.depthState,
      codexState: this.codexState,
      completedRounds: this.completedRounds,
      endingSeen: this.endingSeen,
      isDemoMode: demoMode.isEnabled
    };
  }
  
  /**
   * 打包當前狀態為 StoredData
   */
  getCurrentData(): StoredData {
    return {
      version: 1,
      totalDepth: this.depthState.totalDepth,
      completedRounds: this.completedRounds,
      endingSeen: this.endingSeen,
      codex: this.codexState,
      settings: {},
      currentState: {
        state: this.stateMachine.getState(),
        roundStartAt: this.timerState?.roundStartAt ?? null,
        lastSeenAt: this.timerState?.lastSeenAt ?? null,
        hiddenAt: this.timerState?.hiddenAt ?? null,
        selectedDurationMs: this.timerState?.selectedDurationMs ?? null,
        distractionPenaltyMs: this.timerState?.distractionPenaltyMs ?? 0,
        roundStartDepth: this.depthState.roundStartDepth,
        roundDescentDepth: this.depthState.roundDescentDepth,
        roundRisePenalty: this.depthState.roundRisePenalty
      }
    };
  }
  
  /**
   * 處理開始專注
   */
  handleStartFocus(durationMinutes: number): boolean {
    const result = this.stateMachine.transition({
      type: 'START_FOCUS',
      durationMinutes
    });
    
    if (!result.success) {
      console.error('Failed to start focus:', result.error);
      return false;
    }
    
    // 初始化 TimerState
    this.timerState = timer.start(durationMinutes, demoMode.isEnabled);
    
    // 設定本輪開始深度
    this.depthState.roundStartDepth = this.depthState.totalDepth;
    this.depthState.roundDescentDepth = 0;
    this.depthState.roundRisePenalty = 0;
    
    // 儲存
    this.save();
    
    return true;
  }
  
  /**
   * 處理放棄當前輪次
   */
  handleAbandonRound(): boolean {
    const result = this.stateMachine.transition({ type: 'ABANDON_ROUND' });
    
    if (!result.success) {
      console.error('Failed to abandon round:', result.error);
      return false;
    }
    
    // 保留已獲得的深度
    if (this.timerState) {
      const nowMs = Date.now();
      const focusedTime = timer.getElapsedFocusedTime(this.timerState, nowMs);
      this.depthState = this.depthCalculator.updateRoundDescent(this.depthState, focusedTime);
      this.depthState = this.depthCalculator.abandonRound(this.depthState);
    }
    
    // 清除 TimerState
    this.timerState = null;
    
    // 儲存
    this.save();
    
    return true;
  }
  
  /**
   * 處理跳過休息
   */
  handleSkipBreak(): boolean {
    const result = this.stateMachine.transition({ type: 'SKIP_BREAK' });
    
    if (!result.success) {
      console.error('Failed to skip break:', result.error);
      return false;
    }
    
    // 儲存
    this.save();
    
    return true;
  }
  
  /**
   * 處理 ENDING 確認
   */
  handleEndingConfirmed(): boolean {
    const result = this.stateMachine.transition({ type: 'ENDING_CONFIRMED' });
    
    if (!result.success) {
      console.error('Failed to confirm ending:', result.error);
      return false;
    }
    
    // 儲存
    this.save();
    
    return true;
  }
  
  /**
   * 處理重新下潛
   * 
   * 重要：IDLE 狀態的 DIVE_AGAIN 事件只能在 endingSeen 為 true 時執行
   * （Controller 層檢查，StateMachine 不檢查）
   */
  handleDiveAgain(): boolean {
    // Controller 層檢查：只有 endingSeen 為 true 時才允許
    if (!this.endingSeen) {
      console.error('Cannot dive again: ending not seen yet');
      return false;
    }
    
    const result = this.stateMachine.transition({ type: 'DIVE_AGAIN' });
    
    if (!result.success) {
      console.error('Failed to dive again:', result.error);
      return false;
    }
    
    // 重置深度
    this.depthState = this.depthCalculator.resetDepth(this.depthState);
    
    // 圖鑑與完成輪數保留（不重置）
    
    // 儲存
    this.save();
    
    return true;
  }
  
  /**
   * 儲存到 localStorage
   */
  save(): void {
    storage.save(this.getCurrentData(), demoMode.isEnabled);
    this.lastSaveTime = Date.now();
  }
  
  /**
   * 從 localStorage 復原狀態
   */
  restoreFromStorage(): void {
    const data = storage.load(demoMode.isEnabled);
    
    if (!data) {
      // 沒有存檔，使用預設值
      return;
    }
    
    // 復原圖鑑與完成輪數
    this.completedRounds = data.completedRounds;
    this.endingSeen = data.endingSeen;
    this.codexState = data.codex;
    
    // 處理未完成狀態
    const savedState = data.currentState.state;
    
    if (savedState === AppState.FOCUSING || savedState === AppState.DISTRACTED) {
      // 視為放棄：使用 lastSeenAt 計算保留深度
      
      // 載入本輪的起始深度和上浮懲罰
      this.depthState.roundStartDepth = data.currentState.roundStartDepth;
      this.depthState.roundRisePenalty = data.currentState.roundRisePenalty;
      this.depthState.totalDepth = data.totalDepth; // 重要：先載入總深度
      
      // 重建 TimerState
      const restoredTimerState: TimerState = {
        roundStartAt: data.currentState.roundStartAt!,
        selectedDurationMs: data.currentState.selectedDurationMs!,
        lastSeenAt: data.currentState.lastSeenAt ?? data.currentState.roundStartAt!,
        hiddenAt: data.currentState.hiddenAt,
        distractionPenaltyMs: data.currentState.distractionPenaltyMs,
        isDemoMode: demoMode.isEnabled
      };
      
      // 計算保留深度
      const lastSeenAt = restoredTimerState.lastSeenAt;
      const focusedTime = timer.getElapsedFocusedTime(restoredTimerState, lastSeenAt);
      
      // 限制不超過選定時長
      const cappedTime = Math.min(focusedTime, restoredTimerState.selectedDurationMs);
      
      // 計算下沉深度
      const descent = this.depthCalculator.calculateDescent(cappedTime);
      this.depthState.roundDescentDepth = descent;
      
      // 放棄本輪（保留深度）
      this.depthState = this.depthCalculator.abandonRound(this.depthState);
      
      // 直接設定狀態為 IDLE（不走 transition）
      this.stateMachine.currentState = AppState.IDLE;
      
    } else if (savedState === AppState.SHORT_BREAK || savedState === AppState.LONG_BREAK) {
      // 視為休息完成
      // 恢復總深度
      this.depthState.totalDepth = data.totalDepth;
      this.depthState.roundStartDepth = data.totalDepth;
      this.depthState.roundDescentDepth = 0;
      this.depthState.roundRisePenalty = 0;
      
      this.stateMachine.currentState = AppState.IDLE;
      
    } else {
      // IDLE、ENDING 保持原狀
      this.depthState.totalDepth = data.totalDepth;
      this.depthState.roundStartDepth = data.currentState.roundStartDepth;
      this.depthState.roundDescentDepth = data.currentState.roundDescentDepth;
      this.depthState.roundRisePenalty = data.currentState.roundRisePenalty;
      
      this.stateMachine.currentState = savedState;
    }
    
    // 清除 timerState（因為回到 IDLE 或保持 ENDING）
    this.timerState = null;
  }
  
  /**
   * RAF loop 更新
   */
  update(): void {
    const nowMs = Date.now();
    const state = this.stateMachine.getState();
    
    if (state === AppState.FOCUSING && this.timerState) {
      // 更新深度
      const focusedTime = timer.getElapsedFocusedTime(this.timerState, nowMs);
      this.depthState = this.depthCalculator.updateRoundDescent(this.depthState, focusedTime);
      
      // 檢查是否完成
      if (timer.isComplete(this.timerState, nowMs)) {
        this.handleRoundComplete();
      }
      
      // 定期更新 lastSeenAt 和自動儲存
      if (nowMs - this.lastSaveTime > Config.autoSaveInterval * 1000) {
        this.timerState = timer.updateLastSeen(this.timerState, nowMs);
        this.save();
        this.lastSaveTime = nowMs;
      }
      
    } else if (state === AppState.DISTRACTED) {
      // DISTRACTED 狀態自動結束（倒數 3 秒）
      const distractedDuration = nowMs - this.distractedStartAt;
      if (distractedDuration >= Config.distractedDurationSec * 1000) {
        this.stateMachine.transition({ type: 'DISTRACTION_ANIMATION_COMPLETE' });
      }
      
    } else if (state === AppState.SHORT_BREAK || state === AppState.LONG_BREAK) {
      // 休息倒數
      const breakElapsed = nowMs - this.breakStartAt;
      
      // 檢查休息是否完成
      if (breakElapsed >= this.breakDurationMs) {
        this.stateMachine.transition({ type: 'BREAK_COMPLETE' });
        this.save();
      }
    }
  }
  
  /**
   * 處理完成一輪
   */
  private handleRoundComplete(): void {
    if (!this.timerState) {
      return;
    }
    
    // 確保深度已更新到最終值
    const nowMs = Date.now();
    const focusedTime = timer.getElapsedFocusedTime(this.timerState, nowMs);
    this.depthState = this.depthCalculator.updateRoundDescent(this.depthState, focusedTime);
    
    // 1. 先完成深度計算（commitRound）
    this.depthState = this.depthCalculator.commitRound(this.depthState);
    
    // 2. 再用 commit 後的深度判斷是否達目標
    const reachedTarget = this.depthCalculator.hasReachedTarget(this.depthState.totalDepth);
    
    // 3. 判斷是否應該進入 ENDING（第一次到底）
    const shouldShowEnding = reachedTarget && !this.endingSeen;
    
    // 4. 計算是否長休息（只有非 ENDING 時才判斷）
    const isLongBreak = !shouldShowEnding && 
                        (this.completedRounds + 1) % Config.longBreakInterval === 0;
    
    // 5. 選擇卡片（修改 codexState，可能新增或更新）
    codexManager.selectCardForRound(
      this.depthState.totalDepth,
      this.codexState,
      shouldShowEnding
    );
    
    // 6. 增加完成輪數
    this.completedRounds += 1;
    
    // 7. 如果進入 ENDING，設定 endingSeen
    if (shouldShowEnding) {
      this.endingSeen = true;
    }
    
    // 8. 轉換狀態
    this.stateMachine.transition({
      type: 'ROUND_COMPLETE',
      shouldShowEnding,
      isLongBreak
    });
    
    // 9. 初始化休息計時器（如果進入 SHORT_BREAK 或 LONG_BREAK）
    if (!shouldShowEnding) {
      this.breakStartAt = Date.now();
      this.breakDurationMs = isLongBreak 
        ? Config.longBreakDuration * 60 * 1000 
        : Config.shortBreakDuration * 60 * 1000;
    }
    
    // 10. 清除 TimerState
    this.timerState = null;
    
    // 11. 儲存
    this.save();
  }
  
  /**
   * 處理分頁可見性變化
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // 分頁隱藏
      if (this.stateMachine.getState() === AppState.FOCUSING && this.timerState) {
        this.timerState = timer.markHidden(this.timerState, Date.now());
        this.save(); // 立即儲存
      }
    } else {
      // 分頁顯示
      if (this.stateMachine.getState() === AppState.FOCUSING && this.timerState) {
        const { state: newTimerState, hiddenRealMs, hiddenDuration } = timer.markVisible(
          this.timerState,
          Date.now()
        );
        this.timerState = newTimerState;
        
        // 判斷是否觸發分心（使用真實時間 hiddenRealMs）
        const event = distractionDetector.checkDistraction(hiddenRealMs);
        
        if (event.triggered) {
          // 觸發分心：轉換狀態
          this.stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
          this.distractedStartAt = Date.now();
          
          // 計算上浮懲罰
          const penalty = distractionDetector.calculateRisePenalty(
            this.depthState.roundDescentDepth
          );
          this.depthState = this.depthCalculator.applyRisePenalty(this.depthState, penalty);
          
          // 將隱藏時間加入懲罰（使用加速後的 hiddenDuration）
          this.timerState = timer.applyDistractionPenalty(this.timerState, hiddenDuration);
          
          this.save();
        }
        // 若未觸發，時間自動計入專注（不需額外處理）
      }
    }
  }
  
  /**
   * 處理頁面關閉
   */
  private handlePageHide(): void {
    if (this.stateMachine.getState() === AppState.FOCUSING && this.timerState) {
      this.timerState = timer.updateLastSeen(this.timerState, Date.now());
      this.save();
    }
  }
}

/**
 * 建立 AppController 實例
 */
export function createAppController(): AppController {
  return new AppControllerImpl();
}
