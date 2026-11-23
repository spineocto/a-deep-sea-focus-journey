/**
 * Application Controller Tests
 * 
 * Tests the coordination logic of the Application Controller,
 * including initialization, user operations, and state restoration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAppController, type AppController } from '../app-controller.js';
import { AppState } from '../state-machine.js';
import { storage } from '../storage.js';
import { demoMode } from '../demo-mode.js';
import { Config } from '../config.js';

describe('AppController', () => {
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
    
    // Clear localStorage before each test
    storage.clearAll();
    
    // Reset demo mode
    if (demoMode.isEnabled) {
      demoMode.toggle();
    }
    
    // Create new controller
    controller = createAppController();
  });
  
  describe('初始化', () => {
    it('should initialize with IDLE state', () => {
      const state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
      expect(state.timerState).toBeNull();
      expect(state.depthState.totalDepth).toBe(0);
      expect(state.completedRounds).toBe(0);
      expect(state.endingSeen).toBe(false);
    });
    
    it('should have empty codex initially', () => {
      const state = controller.getState();
      expect(state.codexState.unlockedCards).toEqual([]);
    });
  });
  
  describe('開始專注', () => {
    it('should start focus with valid duration', () => {
      const success = controller.handleStartFocus(25);
      
      expect(success).toBe(true);
      
      const state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.FOCUSING);
      expect(state.timerState).not.toBeNull();
      expect(state.timerState?.selectedDurationMs).toBe(25 * 60 * 1000);
    });
    
    it('should set round start depth to current total depth', () => {
      controller.handleStartFocus(25);
      
      const state = controller.getState();
      expect(state.depthState.roundStartDepth).toBe(state.depthState.totalDepth);
      expect(state.depthState.roundDescentDepth).toBe(0);
      expect(state.depthState.roundRisePenalty).toBe(0);
    });
    
    it('should save after starting focus', () => {
      controller.handleStartFocus(25);
      
      // Check that data was saved
      const saved = storage.load(false);
      expect(saved).not.toBeNull();
      expect(saved?.currentState.state).toBe(AppState.FOCUSING);
    });
  });
  
  describe('放棄輪次', () => {
    it('should abandon round from FOCUSING state', () => {
      controller.handleStartFocus(25);
      
      // Simulate some time passing
      vi.useFakeTimers();
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      
      const success = controller.handleAbandonRound();
      
      expect(success).toBe(true);
      
      const state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
      expect(state.timerState).toBeNull();
      
      // Depth should be preserved (5 minutes = 60 meters)
      expect(state.depthState.totalDepth).toBeGreaterThan(0);
      
      vi.useRealTimers();
    });
    
    it('should preserve depth when abandoning', () => {
      controller.handleStartFocus(25);
      
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime + 10 * 60 * 1000); // 10 minutes later
      
      controller.handleAbandonRound();
      
      const state = controller.getState();
      // 10 minutes × 12 m/min = 120 meters
      expect(state.depthState.totalDepth).toBeCloseTo(120, 0);
      
      vi.useRealTimers();
    });
  });
  
  describe('重新下潛 (Dive Again)', () => {
    it('should reject dive again when endingSeen is false', () => {
      const success = controller.handleDiveAgain();
      
      expect(success).toBe(false);
      
      const state = controller.getState();
      expect(state.depthState.totalDepth).toBe(0);
    });
    
    it('should reset depth when endingSeen is true', () => {
      // Manually set endingSeen to true (simulating reaching ending)
      const state = controller.getState();
      (controller as any).endingSeen = true;
      
      // Set some depth
      (controller as any).depthState.totalDepth = 10900;
      (controller as any).depthState.roundStartDepth = 10900;
      
      const success = controller.handleDiveAgain();
      
      expect(success).toBe(true);
      
      const newState = controller.getState();
      expect(newState.depthState.totalDepth).toBe(0);
      expect(newState.depthState.roundStartDepth).toBe(0);
    });
    
    it('should preserve codex and completed rounds when diving again', () => {
      // Set up state
      (controller as any).endingSeen = true;
      (controller as any).completedRounds = 10;
      (controller as any).codexState.unlockedCards.push({
        cardId: 'moon-jellyfish',
        unlockedAt: Date.now(),
        obtainedCount: 1
      });
      
      controller.handleDiveAgain();
      
      const state = controller.getState();
      expect(state.completedRounds).toBe(10);
      expect(state.codexState.unlockedCards.length).toBe(1);
    });
  });
  
  describe('getCurrentData', () => {
    it('should package state into StoredData format', () => {
      controller.handleStartFocus(25);
      
      const data = controller.getCurrentData();
      
      expect(data.version).toBe(2);
      expect(data.totalDepth).toBe(0);
      expect(data.completedRounds).toBe(0);
      expect(data.endingSeen).toBe(false);
      expect(data.codex).toEqual({ unlockedCards: [] });
      expect(data.settings).toEqual({});
      expect(data.currentState.state).toBe(AppState.FOCUSING);
      expect(data.currentState.roundStartAt).not.toBeNull();
      expect(data.currentState.selectedDurationMs).toBe(25 * 60 * 1000);
    });
    
    it('should handle null timerState', () => {
      const data = controller.getCurrentData();
      
      expect(data.currentState.roundStartAt).toBeNull();
      expect(data.currentState.lastSeenAt).toBeNull();
      expect(data.currentState.hiddenAt).toBeNull();
      expect(data.currentState.selectedDurationMs).toBeNull();
    });
  });
  
  describe('restoreFromStorage - FOCUSING/DISTRACTED 處理', () => {
    it('should restore and abandon FOCUSING state on reload', () => {
      // Start a focus session
      controller.handleStartFocus(25);
      
      vi.useFakeTimers();
      const startTime = Date.now();
      
      // Simulate 10 minutes passing
      vi.setSystemTime(startTime + 10 * 60 * 1000);
      
      // Update lastSeenAt
      const state = controller.getState();
      if (state.timerState) {
        (controller as any).timerState = {
          ...state.timerState,
          lastSeenAt: Date.now()
        };
      }
      
      // Save
      controller.save();
      
      // Create new controller (simulating page reload)
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const newState = newController.getState();
      
      // Should be IDLE after restoration
      expect(newState.stateMachine.getState()).toBe(AppState.IDLE);
      expect(newState.timerState).toBeNull();
      
      // Depth should be preserved (10 minutes = 120 meters)
      expect(newState.depthState.totalDepth).toBeCloseTo(120, 0);
      
      vi.useRealTimers();
    });
    
    it('should cap preserved depth to selectedDuration', () => {
      controller.handleStartFocus(25);
      
      vi.useFakeTimers();
      const startTime = Date.now();
      
      // Simulate 30 minutes passing (more than selected 25)
      vi.setSystemTime(startTime + 30 * 60 * 1000);
      
      const state = controller.getState();
      if (state.timerState) {
        (controller as any).timerState = {
          ...state.timerState,
          lastSeenAt: Date.now()
        };
      }
      
      controller.save();
      
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const newState = newController.getState();
      
      // Should be capped to 25 minutes = 300 meters
      expect(newState.depthState.totalDepth).toBeCloseTo(300, 0);
      
      vi.useRealTimers();
    });
  });
  
  describe('restoreFromStorage - BREAK 狀態處理', () => {
    it('should treat SHORT_BREAK as completed on reload', () => {
      // Manually set state to SHORT_BREAK and save
      (controller as any).stateMachine.currentState = AppState.SHORT_BREAK;
      (controller as any).depthState.totalDepth = 100;
      controller.save();
      
      // Create new controller and restore
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const state = newController.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
      expect(state.depthState.totalDepth).toBe(100);
    });
    
    it('should treat LONG_BREAK as completed on reload', () => {
      (controller as any).stateMachine.currentState = AppState.LONG_BREAK;
      (controller as any).depthState.totalDepth = 500;
      controller.save();
      
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const state = newController.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
      expect(state.depthState.totalDepth).toBe(500);
    });
  });
  
  describe('restoreFromStorage - IDLE/ENDING 保持原狀', () => {
    it('should preserve IDLE state on reload', () => {
      (controller as any).depthState.totalDepth = 200;
      controller.save();
      
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const state = newController.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
      expect(state.depthState.totalDepth).toBe(200);
    });
    
    it('should preserve ENDING state on reload', () => {
      (controller as any).stateMachine.currentState = AppState.ENDING;
      (controller as any).depthState.totalDepth = 10900;
      (controller as any).endingSeen = true;
      controller.save();
      
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const state = newController.getState();
      expect(state.stateMachine.getState()).toBe(AppState.ENDING);
      expect(state.depthState.totalDepth).toBe(10900);
      expect(state.endingSeen).toBe(true);
    });
  });
  
  describe('跳過休息', () => {
    it('should skip break and return to IDLE', () => {
      // Set up SHORT_BREAK state
      (controller as any).stateMachine.currentState = AppState.SHORT_BREAK;
      
      const success = controller.handleSkipBreak();
      
      expect(success).toBe(true);
      
      const state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('ENDING 確認', () => {
    it('should confirm ending and return to IDLE', () => {
      // Set up ENDING state
      (controller as any).stateMachine.currentState = AppState.ENDING;
      
      const success = controller.handleEndingConfirmed();
      
      expect(success).toBe(true);
      
      const state = controller.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('無存檔時', () => {
    it('should use default values when no saved data', () => {
      storage.clear(false);
      
      const newController = createAppController();
      newController.restoreFromStorage();
      
      const state = newController.getState();
      expect(state.stateMachine.getState()).toBe(AppState.IDLE);
      expect(state.depthState.totalDepth).toBe(0);
      expect(state.completedRounds).toBe(0);
      expect(state.endingSeen).toBe(false);
      expect(state.codexState.unlockedCards).toEqual([]);
    });

  describe('RAF Loop - update() 方法', () => {
    describe('FOCUSING 狀態處理', () => {
      it('should update depth during FOCUSING', () => {
        controller.handleStartFocus(25);
        
        vi.useFakeTimers();
        const startTime = Date.now();
        
        // Simulate 5 minutes passing
        vi.setSystemTime(startTime + 5 * 60 * 1000);
        
        // Call update
        controller.update();
        
        const state = controller.getState();
        // 5 minutes × 12 m/min = 60 meters
        expect(state.depthState.roundDescentDepth).toBeCloseTo(60, 0);
        
        vi.useRealTimers();
      });
      
      it('should periodically update lastSeenAt (every 5 seconds)', () => {
        controller.handleStartFocus(25);
        
        vi.useFakeTimers();
        const startTime = Date.now();
        const initialState = controller.getState();
        const initialLastSeen = initialState.timerState?.lastSeenAt ?? 0;
        
        // Advance 6 seconds
        vi.setSystemTime(startTime + 6 * 1000);
        controller.update();
        
        const updatedState = controller.getState();
        const updatedLastSeen = updatedState.timerState?.lastSeenAt ?? 0;
        
        // lastSeenAt should be updated
        expect(updatedLastSeen).toBeGreaterThan(initialLastSeen);
        
        vi.useRealTimers();
      });
      
      it('should check completion and trigger handleRoundComplete', () => {
        controller.handleStartFocus(25);
        
        vi.useFakeTimers();
        const startTime = Date.now();
        
        // Advance past the duration (25 minutes + 1 second)
        vi.setSystemTime(startTime + (25 * 60 + 1) * 1000);
        
        // Call update
        controller.update();
        
        const state = controller.getState();
        // Should transition to break state (SHORT_BREAK for first round)
        expect(state.stateMachine.getState()).toBe(AppState.SHORT_BREAK);
        expect(state.completedRounds).toBe(1);
        
        vi.useRealTimers();
      });
    });
    
    describe('DISTRACTED 狀態處理', () => {
      it('should automatically return to FOCUSING after 3 seconds', () => {
        controller.handleStartFocus(25);
        
        vi.useFakeTimers();
        const startTime = Date.now();
        
        // Manually trigger distraction
        (controller as any).stateMachine.currentState = AppState.DISTRACTED;
        (controller as any).distractedStartAt = startTime;
        
        // Advance 3 seconds
        vi.setSystemTime(startTime + 3 * 1000);
        
        // Call update
        controller.update();
        
        const state = controller.getState();
        expect(state.stateMachine.getState()).toBe(AppState.FOCUSING);
        
        vi.useRealTimers();
      });
      
      it('should NOT return to FOCUSING before 3 seconds', () => {
        controller.handleStartFocus(25);
        
        vi.useFakeTimers();
        const startTime = Date.now();
        
        (controller as any).stateMachine.currentState = AppState.DISTRACTED;
        (controller as any).distractedStartAt = startTime;
        
        // Advance only 2 seconds
        vi.setSystemTime(startTime + 2 * 1000);
        
        controller.update();
        
        const state = controller.getState();
        expect(state.stateMachine.getState()).toBe(AppState.DISTRACTED);
        
        vi.useRealTimers();
      });
    });
    
    describe('SHORT_BREAK 狀態處理', () => {
      it('should countdown and complete SHORT_BREAK', () => {
        // Manually set up SHORT_BREAK state
        (controller as any).stateMachine.currentState = AppState.SHORT_BREAK;
        
        vi.useFakeTimers();
        const startTime = Date.now();
        (controller as any).breakStartAt = startTime;
        (controller as any).breakDurationMs = 5 * 60 * 1000; // 5 minutes
        
        // Advance past break duration
        vi.setSystemTime(startTime + (5 * 60 + 1) * 1000);
        
        controller.update();
        
        const state = controller.getState();
        expect(state.stateMachine.getState()).toBe(AppState.IDLE);
        
        vi.useRealTimers();
      });
      
      it('should NOT complete SHORT_BREAK before time is up', () => {
        (controller as any).stateMachine.currentState = AppState.SHORT_BREAK;
        
        vi.useFakeTimers();
        const startTime = Date.now();
        (controller as any).breakStartAt = startTime;
        (controller as any).breakDurationMs = 5 * 60 * 1000;
        
        // Advance only 3 minutes
        vi.setSystemTime(startTime + 3 * 60 * 1000);
        
        controller.update();
        
        const state = controller.getState();
        expect(state.stateMachine.getState()).toBe(AppState.SHORT_BREAK);
        
        vi.useRealTimers();
      });
    });
    
    describe('LONG_BREAK 狀態處理', () => {
      it('should countdown and complete LONG_BREAK', () => {
        (controller as any).stateMachine.currentState = AppState.LONG_BREAK;
        
        vi.useFakeTimers();
        const startTime = Date.now();
        (controller as any).breakStartAt = startTime;
        (controller as any).breakDurationMs = 15 * 60 * 1000; // 15 minutes
        
        // Advance past break duration
        vi.setSystemTime(startTime + (15 * 60 + 1) * 1000);
        
        controller.update();
        
        const state = controller.getState();
        expect(state.stateMachine.getState()).toBe(AppState.IDLE);
        
        vi.useRealTimers();
      });
    });
  });
});

});

  // Bug fix tests for Demo Mode
  describe('Demo Mode Bug Fixes', () => {
    it('should accelerate break duration in demo mode', () => {
      // Enable demo mode
      demoMode.toggle();
      const controller = createAppController();
      controller.init();

      // Start a 25-minute focus in demo mode
      controller.handleStartFocus(25);

      // Simulate 25 minutes (in demo mode, this is 25 seconds real time)
      const state = controller.getState();
      if (!state.timerState) {
        throw new Error('TimerState should exist');
      }

      // Complete the round by advancing time
      vi.setSystemTime(state.timerState.roundStartAt + (25 * 60 * 1000) / Config.demoModeMultiplier + 100);
      controller.update();

      // Should be in SHORT_BREAK
      expect(controller.getState().stateMachine.getState()).toBe(AppState.SHORT_BREAK);

      // Check that break duration is accelerated (5 minutes / 60 = 5 seconds)
      const expectedBreakDuration = (Config.shortBreakDuration * 60 * 1000) / Config.demoModeMultiplier;
      expect((controller as any).breakDurationMs).toBe(expectedBreakDuration);

      demoMode.toggle(); // Reset
    });

    it('should accelerate long break duration in demo mode', () => {
      // Enable demo mode and clear storage
      localStorage.clear();
      demoMode.toggle();
      const controller = createAppController();
      controller.init();

      // Complete 3 rounds
      for (let i = 0; i < 3; i++) {
        controller.handleStartFocus(25);
        const state = controller.getState();
        if (!state.timerState) throw new Error('TimerState should exist');
        vi.setSystemTime(state.timerState.roundStartAt + (25 * 60 * 1000) / Config.demoModeMultiplier + 100);
        controller.update();
        controller.handleSkipBreak();
      }

      // Start 4th round
      controller.handleStartFocus(25);
      const state = controller.getState();
      if (!state.timerState) throw new Error('TimerState should exist');
      vi.setSystemTime(state.timerState.roundStartAt + (25 * 60 * 1000) / Config.demoModeMultiplier + 100);
      controller.update();

      // Should be in LONG_BREAK
      expect(controller.getState().stateMachine.getState()).toBe(AppState.LONG_BREAK);

      // Check that break duration is accelerated (15 minutes / 60 = 15 seconds)
      const expectedBreakDuration = (Config.longBreakDuration * 60 * 1000) / Config.demoModeMultiplier;
      expect((controller as any).breakDurationMs).toBe(expectedBreakDuration);

      demoMode.toggle(); // Reset
    });

    it('should reset to initial values when switching to demo mode with no save', () => {
      // Start in normal mode with some progress
      const controller = createAppController();
      controller.init();
      
      controller.handleStartFocus(25);
      const state1 = controller.getState();
      if (!state1.timerState) throw new Error('TimerState should exist');
      
      // Advance time and accumulate depth
      vi.setSystemTime(state1.timerState.roundStartAt + 10 * 60 * 1000);
      controller.update();
      
      // Complete round
      vi.setSystemTime(state1.timerState.roundStartAt + 25 * 60 * 1000 + 100);
      controller.update();
      
      // Should have depth and completed rounds
      const stateBeforeToggle = controller.getState();
      expect(stateBeforeToggle.depthState.totalDepth).toBeGreaterThan(0);
      expect(stateBeforeToggle.completedRounds).toBe(1);
      
      // Clear all storage before toggling
      localStorage.clear();
      
      // Toggle to demo mode (no demo save exists, should reset)
      demoMode.toggle();
      const controller2 = createAppController();
      controller2.init(); // This should restore, but find no save and reset
      
      // Should be reset to initial values
      const stateAfterToggle = controller2.getState();
      expect(stateAfterToggle.depthState.totalDepth).toBe(0);
      expect(stateAfterToggle.depthState.roundStartDepth).toBe(0);
      expect(stateAfterToggle.depthState.roundDescentDepth).toBe(0);
      expect(stateAfterToggle.depthState.roundRisePenalty).toBe(0);
      expect(stateAfterToggle.completedRounds).toBe(0);
      expect(stateAfterToggle.endingSeen).toBe(false);
      expect(stateAfterToggle.codexState.unlockedCards.length).toBe(0);
      expect(stateAfterToggle.stateMachine.getState()).toBe(AppState.IDLE);
      expect(stateAfterToggle.timerState).toBeNull();
      
      demoMode.toggle(); // Reset
    });
  });
