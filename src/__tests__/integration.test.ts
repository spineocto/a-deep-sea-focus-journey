/**
 * Complete Scenario Integration Tests
 * 
 * Tests complete end-to-end scenarios covering all major workflows:
 * - Complete rounds with and without distractions
 * - Long break triggering on 4th round
 * - Reaching target depth and ENDING state
 * - Dive again functionality
 * - Page close/reopen scenarios
 * 
 * These tests simulate real user interactions and validate the entire
 * system behavior across multiple modules working together.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createAppController, type AppController } from '../app-controller.js';
import { AppState } from '../state-machine.js';
import { storage } from '../storage.js';
import { demoMode } from '../demo-mode.js';
import { Config } from '../config.js';
import { timer } from '../timer.js';

describe('Complete Scenario Integration Tests', () => {
  let controller: AppController;
  
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
    // Setup localStorage mock
    localStorageMock.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    
    storage.clearAll();
    
    // Ensure demo mode is off
    if (demoMode.isEnabled) {
      demoMode.toggle();
    }
    
    controller = createAppController();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('測試情境 1: 完整一輪無分心', () => {
    it('應該完成 25 分鐘專注，下沉約 300m，獲得一張卡片，進入 SHORT_BREAK', () => {
      vi.useFakeTimers();
      
      // 開始專注 25 分鐘
      controller.handleStartFocus(25);
      
      let state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.FOCUSING);
      expect(state.depthState.roundStartDepth).toBe(0);
      
      const startTime = Date.now();
      
      // 模擬時間流逝至完成 (25 分鐘)
      vi.setSystemTime(startTime + 25 * 60 * 1000);
      
      // 更新深度計算
      if (state.timerState) {
        const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      // 觸發完成一輪
      (controller as any).handleRoundComplete();
      
      state = controller.getState();
      
      // 驗證深度計算 (25 分鐘 × 12 m/min = 300m)
      expect(state.depthState.totalDepth).toBeCloseTo(300, 0);
      
      // 驗證獲得一張卡片 (Moon jellyfish)
      expect(state.codexState.unlockedCards.length).toBe(1);
      expect(state.codexState.unlockedCards[0].cardId).toBe('moon-jellyfish');
      
      // 驗證進入 SHORT_BREAK 狀態 (第 1 輪不是長休息)
      expect(state.stateMachine.getState()).toBe(AppState.SHORT_BREAK);
      
      // 驗證完成輪數增加
      expect(state.completedRounds).toBe(1);
      
      vi.useRealTimers();
    });
  });
  
  describe('測試情境 2: 完整一輪有分心', () => {
    it('應該觸發分心，計算上浮懲罰，驗證淨深度', () => {
      vi.useFakeTimers();
      
      // 開始專注 25 分鐘
      controller.handleStartFocus(25);
      
      const startTime = Date.now();
      
      // 模擬專注 10 分鐘
      vi.setSystemTime(startTime + 10 * 60 * 1000);
      
      // 更新深度 (10 分鐘 = 120m)
      let state = controller.getState();
      if (state.timerState) {
        const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      // 模擬隱藏 10 秒 (觸發分心)
      const hideTime = Date.now();
      (controller as any).timerState = timer.markHidden(
        (controller as any).timerState,
        hideTime
      );
      
      // 10 秒後顯示
      vi.setSystemTime(hideTime + 10 * 1000);
      
      const visibleResult = timer.markVisible(
        (controller as any).timerState,
        Date.now()
      );
      (controller as any).timerState = visibleResult.state;
      
      // 驗證觸發分心 (> 5 秒)
      expect(visibleResult.hiddenRealMs).toBe(10 * 1000);
      
      // 手動觸發分心狀態轉換
      const transitionResult = (controller as any).stateMachine.transition({
        type: 'DISTRACTION_DETECTED'
      });
      expect(transitionResult.success).toBe(true);
      
      // 計算上浮懲罰 (20% of 120m = 24m)
      const currentDescent = (controller as any).depthState.roundDescentDepth;
      const penalty = (controller as any).depthCalculator.calculateRisePenalty(currentDescent);
      expect(penalty).toBeCloseTo(24, 0);
      
      // 套用懲罰
      (controller as any).depthState = (controller as any).depthCalculator.applyRisePenalty(
        (controller as any).depthState,
        penalty
      );
      
      // 套用分心時間懲罰
      (controller as any).timerState = timer.applyDistractionPenalty(
        (controller as any).timerState,
        visibleResult.hiddenDuration
      );
      
      // 驗證轉到 DISTRACTED 狀態
      state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.DISTRACTED);
      
      // 模擬 3 秒後自動回到 FOCUSING
      (controller as any).distractedStartAt = Date.now();
      vi.setSystemTime(Date.now() + 3 * 1000);
      
      const animResult = (controller as any).stateMachine.transition({
        type: 'DISTRACTION_ANIMATION_COMPLETE'
      });
      expect(animResult.success).toBe(true);
      
      state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.FOCUSING);
      
      // 繼續專注直到完成 (還需要 15 分鐘 + 10 秒被扣除的時間)
      // 總時間 = 開始時間 + 10分鐘 + 10秒 + 3秒 + 15分鐘 + 10秒
      vi.setSystemTime(startTime + 25 * 60 * 1000 + 10 * 1000 + 3 * 1000 + 10 * 1000);
      
      // 更新深度
      if (state.timerState) {
        const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      // 完成一輪
      (controller as any).handleRoundComplete();
      
      state = controller.getState();
      
      // 驗證淨深度 (300m - 上浮懲罰)
      // 上浮懲罰是 20% of 當時的下沉深度（約 120m）= 24m
      // 但由於計算時機，實際結果可能略有不同，使用寬鬆的範圍
      expect(state.depthState.totalDepth).toBeGreaterThan(270);
      expect(state.depthState.totalDepth).toBeLessThan(285);
      
      vi.useRealTimers();
    });
  });
  
  describe('測試情境 3: 第四輪進入長休息', () => {
    it('應該在完成第 4 輪後進入 LONG_BREAK 而非 SHORT_BREAK', () => {
      vi.useFakeTimers();
      
      // 完成 3 輪短休息
      for (let i = 0; i < 3; i++) {
        controller.handleStartFocus(15);
        const startTime = Date.now();
        
        // 15 分鐘完成
        vi.setSystemTime(startTime + 15 * 60 * 1000);
        
        // 更新深度
        let state = controller.getState();
        if (state.timerState) {
          const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
          (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
            state.depthState,
            focusedTime
          );
        }
        
        (controller as any).handleRoundComplete();
        
        state = controller.getState();
        expect(state.stateMachine.getState()).toBe(AppState.SHORT_BREAK);
        
        // 跳過休息
        controller.handleSkipBreak();
      }
      
      // 驗證完成 3 輪
      let state = controller.getState();
      expect(state.completedRounds).toBe(3);
      
      // 完成第 4 輪
      controller.handleStartFocus(15);
      const startTime = Date.now();
      vi.setSystemTime(startTime + 15 * 60 * 1000);
      
      // 更新深度
      if (state.timerState) {
        const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      (controller as any).handleRoundComplete();
      
      state = controller.getState();
      
      // 驗證進入 LONG_BREAK
      expect(state.stateMachine.getState()).toBe(AppState.LONG_BREAK);
      expect(state.completedRounds).toBe(4);
      
      vi.useRealTimers();
    });
  });
  
  describe('測試情境 4: 達到 10900m 進入 ENDING', () => {
    it('應該在達到目標深度時進入 ENDING 狀態並解鎖 Supergiant amphipod', () => {
      vi.useFakeTimers();
      
      // 設定接近目標深度 (10600m)
      (controller as any).depthState.totalDepth = 10600;
      (controller as any).depthState.roundStartDepth = 10600;
      (controller as any).completedRounds = 20; // 確保不是第 4 輪
      (controller as any).endingSeen = false;
      
      // 開始一輪 45 分鐘 (會超過 10900m)
      controller.handleStartFocus(45);
      const startTime = Date.now();
      
      // 45 分鐘 = 540m，總共 11140m (會被限制在 10900m)
      vi.setSystemTime(startTime + 45 * 60 * 1000);
      
      // 更新深度
      let state = controller.getState();
      if (state.timerState) {
        const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      // 完成一輪
      (controller as any).handleRoundComplete();
      
      state = controller.getState();
      
      // 驗證進入 ENDING 狀態
      expect(state.stateMachine.getState()).toBe(AppState.ENDING);
      
      // 驗證深度限制在 10900m
      expect(state.depthState.totalDepth).toBe(Config.targetDepth);
      
      // 驗證 endingSeen 設為 true
      expect(state.endingSeen).toBe(true);
      
      // 驗證 Supergiant amphipod 卡片解鎖
      const endingCard = state.codexState.unlockedCards.find(
        u => u.cardId === 'supergiant-amphipod'
      );
      expect(endingCard).toBeDefined();
      
      vi.useRealTimers();
    });
  });
  
  describe('測試情境 5: 重新下潛', () => {
    it('應該重置 totalDepth 為 0，但保留 Codex 和 completedRounds', () => {
      vi.useFakeTimers();
      
      // 先達到 ENDING 狀態
      (controller as any).depthState.totalDepth = 10900;
      (controller as any).depthState.roundStartDepth = 10900;
      (controller as any).completedRounds = 25;
      (controller as any).endingSeen = true;
      
      // 添加一些已解鎖的卡片
      (controller as any).codexState.unlockedCards = [
        { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 3 },
        { cardId: 'barreleye', unlockedAt: Date.now(), obtainedCount: 2 },
        { cardId: 'supergiant-amphipod', unlockedAt: Date.now(), obtainedCount: 1 }
      ];
      
      // 轉換到 ENDING 狀態
      (controller as any).stateMachine.currentState = AppState.ENDING;
      
      const beforeState = controller.getState();
      const cardCountBefore = beforeState.codexState.unlockedCards.length;
      const roundsBefore = beforeState.completedRounds;
      
      // 呼叫 handleDiveAgain
      controller.handleDiveAgain();
      
      const afterState = controller.getState();
      
      // 驗證 totalDepth 重置為 0
      expect(afterState.depthState.totalDepth).toBe(0);
      expect(afterState.depthState.roundStartDepth).toBe(0);
      
      // 驗證 Codex 保留
      expect(afterState.codexState.unlockedCards.length).toBe(cardCountBefore);
      expect(afterState.codexState.unlockedCards).toEqual(beforeState.codexState.unlockedCards);
      
      // 驗證 completedRounds 保留
      expect(afterState.completedRounds).toBe(roundsBefore);
      
      // 驗證 endingSeen 保持 true
      expect(afterState.endingSeen).toBe(true);
      
      // 驗證回到 IDLE 狀態
      expect(afterState.stateMachine.getState()).toBe(AppState.IDLE);
      
      vi.useRealTimers();
    });
  });
  
  describe('測試情境 6: 關頁重開 FOCUSING 狀態', () => {
    it('應該視為放棄，保留部分深度（依據 lastSeenAt），回到 IDLE', () => {
      vi.useFakeTimers();
      
      // 開始專注 25 分鐘
      controller.handleStartFocus(25);
      const startTime = Date.now();
      
      // 專注 10 分鐘
      vi.setSystemTime(startTime + 10 * 60 * 1000);
      
      // 更新 lastSeenAt
      (controller as any).timerState = timer.updateLastSeen(
        (controller as any).timerState,
        Date.now()
      );
      
      // 儲存當前狀態
      (controller as any).save();
      
      // 模擬關頁一段時間 (5 分鐘)
      vi.setSystemTime(Date.now() + 5 * 60 * 1000);
      
      // 建立新 controller 模擬重開
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const restoredState = newController.getState();
      
      // 驗證回到 IDLE 狀態
      expect(restoredState.stateMachine.getState()).toBe(AppState.IDLE);
      
      // 驗證保留深度（應該是 10 分鐘的深度：120m）
      // 因為 lastSeenAt 是在 10 分鐘時更新的
      expect(restoredState.depthState.totalDepth).toBeCloseTo(120, 0);
      
      // 驗證本輪資料已重置
      expect(restoredState.depthState.roundDescentDepth).toBe(0);
      expect(restoredState.depthState.roundRisePenalty).toBe(0);
      
      vi.useRealTimers();
    });
    
    it('應該限制保留深度不超過選定時長計算的深度', () => {
      vi.useFakeTimers();
      
      // 開始專注 15 分鐘
      controller.handleStartFocus(15);
      const startTime = Date.now();
      
      // 專注 20 分鐘 (超過選定時長)
      vi.setSystemTime(startTime + 20 * 60 * 1000);
      
      // 更新 lastSeenAt
      (controller as any).timerState = timer.updateLastSeen(
        (controller as any).timerState,
        Date.now()
      );
      
      // 儲存
      (controller as any).save();
      
      // 重開
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const restoredState = newController.getState();
      
      // 驗證深度被限制在 15 分鐘的深度 (180m)
      expect(restoredState.depthState.totalDepth).toBeLessThanOrEqual(180);
      
      vi.useRealTimers();
    });
  });
  
  describe('測試情境 7: 關頁重開 BREAK 狀態', () => {
    it('應該視為休息完成，回到 IDLE', () => {
      vi.useFakeTimers();
      
      // 完成一輪進入 SHORT_BREAK
      controller.handleStartFocus(15);
      const startTime = Date.now();
      vi.setSystemTime(startTime + 15 * 60 * 1000);
      
      let state = controller.getState();
      if (state.timerState) {
        const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      (controller as any).handleRoundComplete();
      
      state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.SHORT_BREAK);
      
      const depthBefore = state.depthState.totalDepth;
      const roundsBefore = state.completedRounds;
      
      // 儲存
      (controller as any).save();
      
      // 模擬關頁
      vi.setSystemTime(Date.now() + 10 * 60 * 1000);
      
      // 重開
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const restoredState = newController.getState();
      
      // 驗證回到 IDLE
      expect(restoredState.stateMachine.getState()).toBe(AppState.IDLE);
      
      // 驗證深度和輪數保留
      expect(restoredState.depthState.totalDepth).toBe(depthBefore);
      expect(restoredState.completedRounds).toBe(roundsBefore);
      
      vi.useRealTimers();
    });
  });
  
  describe('測試情境 8: 第二次達到 10900m 不顯示 ENDING', () => {
    it('應該在 endingSeen 為 true 後再次完成一輪時進入休息而非 ENDING', () => {
      vi.useFakeTimers();
      
      // 設定 endingSeen 為 true (已經看過 ENDING)
      (controller as any).endingSeen = true;
      (controller as any).depthState.totalDepth = 10600;
      (controller as any).depthState.roundStartDepth = 10600;
      (controller as any).completedRounds = 21; // 不是第 4 輪
      
      // 再次完成一輪達到 10900m
      controller.handleStartFocus(45);
      const startTime = Date.now();
      vi.setSystemTime(startTime + 45 * 60 * 1000);
      
      let state = controller.getState();
      if (state.timerState) {
        const focusedTime = timer.getElapsedFocusedTime(state.timerState, Date.now());
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      (controller as any).handleRoundComplete();
      
      state = controller.getState();
      
      // 驗證進入 SHORT_BREAK 而非 ENDING
      expect(state.stateMachine.getState()).toBe(AppState.SHORT_BREAK);
      expect(state.stateMachine.getState()).not.toBe(AppState.ENDING);
      
      // 驗證深度仍被限制在 10900m
      expect(state.depthState.totalDepth).toBe(Config.targetDepth);
      
      vi.useRealTimers();
    });
  });
});
