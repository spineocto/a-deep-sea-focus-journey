/**
 * Application Controller Integration Tests
 * 
 * Tests complete workflows and integration scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAppController, type AppController } from '../app-controller.js';
import { AppState } from '../state-machine.js';
import { storage } from '../storage.js';
import { demoMode } from '../demo-mode.js';
import { Config } from '../config.js';

describe('AppController Integration', () => {
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
    
    if (demoMode.isEnabled) {
      demoMode.toggle();
    }
    
    controller = createAppController();
  });
  
  describe('完整一輪流程', () => {
    it('should complete a full focus round', () => {
      // Start focus
      controller.handleStartFocus(25);
      
      vi.useFakeTimers();
      const startTime = Date.now();
      
      // Simulate full duration (25 minutes)
      vi.setSystemTime(startTime + 25 * 60 * 1000);
      
      // Update depth before completing
      const state = controller.getState();
      if (state.timerState) {
        const focusedTime = 25 * 60 * 1000; // 25 minutes in ms
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          focusedTime
        );
      }
      
      // Manually trigger round complete (normally done by RAF loop)
      (controller as any).handleRoundComplete();
      
      const newState = controller.getState();
      
      // Should be in break state
      expect([AppState.SHORT_BREAK, AppState.LONG_BREAK, AppState.ENDING]).toContain(
        newState.stateMachine.getState()
      );
      
      // Depth should be 25 × 12 = 300 meters
      expect(newState.depthState.totalDepth).toBeCloseTo(300, 0);
      
      // Should have unlocked a card
      expect(newState.codexState.unlockedCards.length).toBe(1);
      
      // Should have completed 1 round
      expect(newState.completedRounds).toBe(1);
      
      vi.useRealTimers();
    });
    
    it('should trigger long break on 4th round', () => {
      vi.useFakeTimers();
      
      // Complete 3 short rounds
      for (let i = 0; i < 3; i++) {
        controller.handleStartFocus(15);
        const startTime = Date.now();
        vi.setSystemTime(startTime + 15 * 60 * 1000);
        
        // Update depth
        const state = controller.getState();
        if (state.timerState) {
          (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
            state.depthState,
            15 * 60 * 1000
          );
        }
        
        (controller as any).handleRoundComplete();
        
        // Skip the break
        controller.handleSkipBreak();
      }
      
      // 4th round should trigger long break
      controller.handleStartFocus(15);
      const startTime = Date.now();
      vi.setSystemTime(startTime + 15 * 60 * 1000);
      
      // Update depth
      const state = controller.getState();
      if (state.timerState) {
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          15 * 60 * 1000
        );
      }
      
      (controller as any).handleRoundComplete();
      
      const finalState = controller.getState();
      expect(finalState.stateMachine.getState()).toBe(AppState.LONG_BREAK);
      
      vi.useRealTimers();
    });
  });
  
  describe('達到目標深度', () => {
    it('should show ending when reaching 10900m for first time', () => {
      vi.useFakeTimers();
      
      // Set depth close to target
      (controller as any).depthState.totalDepth = 10600;
      (controller as any).depthState.roundStartDepth = 10600;
      (controller as any).completedRounds = 20; // Ensure we're not on a 4th round
      
      // Start a round that will exceed target
      controller.handleStartFocus(45);
      const startTime = Date.now();
      
      // 45 minutes = 540 meters, total = 11140 (capped at 10900)
      vi.setSystemTime(startTime + 45 * 60 * 1000);
      
      // Update depth
      const state = controller.getState();
      if (state.timerState) {
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          45 * 60 * 1000
        );
      }
      
      (controller as any).handleRoundComplete();
      
      const finalState = controller.getState();
      
      // Should be in ENDING state
      expect(finalState.stateMachine.getState()).toBe(AppState.ENDING);
      
      // Depth should be capped at 10900
      expect(finalState.depthState.totalDepth).toBe(Config.targetDepth);
      
      // endingSeen should be true
      expect(finalState.endingSeen).toBe(true);
      
      // Should have unlocked the ending card (Supergiant amphipod)
      const endingCard = finalState.codexState.unlockedCards.find(
        u => u.cardId === 'supergiant-amphipod'
      );
      expect(endingCard).toBeDefined();
      
      vi.useRealTimers();
    });
    
    it('should not show ending again after dive again', () => {
      vi.useFakeTimers();
      
      // First time reaching target
      (controller as any).depthState.totalDepth = 10600;
      (controller as any).depthState.roundStartDepth = 10600;
      (controller as any).endingSeen = false;
      (controller as any).completedRounds = 20;
      
      controller.handleStartFocus(45);
      const startTime = Date.now();
      vi.setSystemTime(startTime + 45 * 60 * 1000);
      
      // Update depth
      let state = controller.getState();
      if (state.timerState) {
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          45 * 60 * 1000
        );
      }
      
      (controller as any).handleRoundComplete();
      
      expect((controller as any).endingSeen).toBe(true);
      
      // Confirm ending and dive again
      controller.handleEndingConfirmed();
      controller.handleDiveAgain();
      
      // Reach target again
      (controller as any).depthState.totalDepth = 10600;
      (controller as any).depthState.roundStartDepth = 10600;
      (controller as any).completedRounds = 21; // Not a 4th round
      
      controller.handleStartFocus(45);
      const startTime2 = Date.now();
      vi.setSystemTime(startTime2 + 45 * 60 * 1000);
      
      // Update depth
      state = controller.getState();
      if (state.timerState) {
        (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
          state.depthState,
          45 * 60 * 1000
        );
      }
      
      (controller as any).handleRoundComplete();
      
      const finalState = controller.getState();
      
      // Should go to SHORT_BREAK, not ENDING
      expect(finalState.stateMachine.getState()).not.toBe(AppState.ENDING);
      
      vi.useRealTimers();
    });
  });
  
  describe('儲存與復原完整性', () => {
    it('should preserve all state through save-load cycle', () => {
      vi.useFakeTimers();
      
      // Complete a few rounds to build up state
      for (let i = 0; i < 2; i++) {
        controller.handleStartFocus(15);
        const startTime = Date.now();
        vi.setSystemTime(startTime + 15 * 60 * 1000);
        
        // Update depth
        const state = controller.getState();
        if (state.timerState) {
          (controller as any).depthState = (controller as any).depthCalculator.updateRoundDescent(
            state.depthState,
            15 * 60 * 1000
          );
        }
        
        (controller as any).handleRoundComplete();
        controller.handleSkipBreak();
      }
      
      const originalState = controller.getState();
      
      // Create new controller and restore
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const restoredState = newController.getState();
      
      // Check key values preserved
      expect(restoredState.depthState.totalDepth).toBe(originalState.depthState.totalDepth);
      expect(restoredState.completedRounds).toBe(originalState.completedRounds);
      expect(restoredState.codexState.unlockedCards.length).toBe(
        originalState.codexState.unlockedCards.length
      );
      
      vi.useRealTimers();
    });
  });
});
