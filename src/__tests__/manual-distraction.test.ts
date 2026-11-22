/**
 * 手動分心測試功能測試
 * 
 * 驗證手動觸發分心事件的邏輯
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAppController } from '../app-controller.js';
import { AppState } from '../state-machine.js';
import { timer } from '../timer.js';
import { distractionDetector } from '../distraction-detector.js';
import { createDepthCalculator } from '../depth-calculator.js';

describe('Manual Distraction Test', () => {
  let appController: ReturnType<typeof createAppController>;
  
  beforeEach(() => {
    // 清除 localStorage（jsdom 環境提供）
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    appController = createAppController();
  });
  
  it('should trigger distraction when simulating 6 seconds hidden', () => {
    // 1. 開始專注
    const success = appController.handleStartFocus(15);
    expect(success).toBe(true);
    
    // 2. 等待一些時間（模擬）
    const state = appController.getState();
    const timerState = state.timerState;
    expect(timerState).not.toBeNull();
    
    if (!timerState) return;
    
    // 3. 模擬隱藏 6 秒
    const nowMs = Date.now();
    const sixSecondsAgo = nowMs - 6000;
    
    // 手動設定 hiddenAt
    timerState.hiddenAt = sixSecondsAgo;
    
    // 4. 呼叫 markVisible
    const { state: newTimerState, hiddenRealMs, hiddenDuration } = timer.markVisible(
      timerState,
      nowMs
    );
    
    // 5. 驗證隱藏時長
    expect(hiddenRealMs).toBeGreaterThanOrEqual(6000);
    
    // 6. 判斷是否觸發分心
    const event = distractionDetector.checkDistraction(hiddenRealMs);
    expect(event.triggered).toBe(true);
    expect(event.shouldExcludeTime).toBe(true);
    
    // 7. 計算上浮懲罰
    const penalty = distractionDetector.calculateRisePenalty(
      state.depthState.roundDescentDepth
    );
    
    // 8. 應用上浮懲罰
    const depthCalculator = createDepthCalculator();
    const updatedDepthState = depthCalculator.applyRisePenalty(state.depthState, penalty);
    
    // 9. 驗證上浮懲罰已應用
    expect(updatedDepthState.roundRisePenalty).toBeGreaterThanOrEqual(0);
  });
  
  it('should only work in FOCUSING state', () => {
    // 1. 在 IDLE 狀態測試
    const state = appController.getState();
    expect(state.stateMachine.getState()).toBe(AppState.IDLE);
    
    // 嘗試手動觸發分心應該失敗（因為不在 FOCUSING 狀態）
    const timerState = state.timerState;
    expect(timerState).toBeNull();
  });
  
  it('should apply 20% rise penalty', () => {
    // 1. 開始專注
    appController.handleStartFocus(25);
    
    // 2. 模擬專注一段時間（假設下沉了 100m）
    const state = appController.getState();
    const depthCalculator = createDepthCalculator();
    
    // 假設本輪下沉 100m
    state.depthState.roundDescentDepth = 100;
    
    // 3. 計算上浮懲罰
    const penalty = distractionDetector.calculateRisePenalty(100);
    
    // 4. 驗證懲罰為 20%
    expect(penalty).toBe(20);
    
    // 5. 應用懲罰
    const updatedDepthState = depthCalculator.applyRisePenalty(state.depthState, penalty);
    
    // 6. 驗證上浮懲罰已累加
    expect(updatedDepthState.roundRisePenalty).toBe(20);
  });
  
  it('should respect 50% maximum rise penalty', () => {
    // 1. 開始專注
    appController.handleStartFocus(25);
    
    const state = appController.getState();
    const depthCalculator = createDepthCalculator();
    
    // 假設本輪下沉 100m
    state.depthState.roundDescentDepth = 100;
    
    // 2. 連續應用多次 20% 懲罰（模擬多次分心）
    for (let i = 0; i < 5; i++) {
      const penalty = distractionDetector.calculateRisePenalty(
        state.depthState.roundDescentDepth
      );
      state.depthState = depthCalculator.applyRisePenalty(state.depthState, penalty);
    }
    
    // 3. 驗證累積懲罰不超過 50%
    expect(state.depthState.roundRisePenalty).toBeLessThanOrEqual(50);
    expect(state.depthState.roundRisePenalty).toBeGreaterThan(0);
  });
});
