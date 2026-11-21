/**
 * Timer 模組單元測試
 * 
 * 測試計時器的核心功能：
 * - 時間戳計算準確性（正常模式）
 * - Demo 模式時間加速（60 倍）
 * - 分心懲罰扣除邏輯
 * - lastSeenAt 更新機制
 * - 隱藏時段時間排除
 * - 邊界情況（nowMs < roundStartAt 回傳 0）
 * - 完成檢查（剩餘時間 <= 0）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { timer, type TimerState } from '../timer';
import { Config } from '../config';

describe('Timer Module', () => {
  describe('start()', () => {
    it('should initialize timer state with current timestamp', () => {
      const beforeStart = Date.now();
      const state = timer.start(25, false);
      const afterStart = Date.now();

      expect(state.roundStartAt).toBeGreaterThanOrEqual(beforeStart);
      expect(state.roundStartAt).toBeLessThanOrEqual(afterStart);
      expect(state.selectedDurationMs).toBe(25 * 60 * 1000);
      expect(state.lastSeenAt).toBe(state.roundStartAt);
      expect(state.hiddenAt).toBeNull();
      expect(state.distractionPenaltyMs).toBe(0);
      expect(state.isDemoMode).toBe(false);
    });

    it('should set demo mode flag correctly', () => {
      const state = timer.start(15, true);
      expect(state.isDemoMode).toBe(true);
    });

    it('should convert duration from minutes to milliseconds', () => {
      const state15 = timer.start(15, false);
      const state25 = timer.start(25, false);
      const state45 = timer.start(45, false);

      expect(state15.selectedDurationMs).toBe(15 * 60 * 1000);
      expect(state25.selectedDurationMs).toBe(25 * 60 * 1000);
      expect(state45.selectedDurationMs).toBe(45 * 60 * 1000);
    });
  });

  describe('getElapsedFocusedTime()', () => {
    it('should calculate elapsed time correctly in normal mode', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // After 5 seconds
      const elapsed5s = timer.getElapsedFocusedTime(state, nowMs + 5000);
      expect(elapsed5s).toBe(5000);

      // After 60 seconds (1 minute)
      const elapsed60s = timer.getElapsedFocusedTime(state, nowMs + 60000);
      expect(elapsed60s).toBe(60000);
    });

    it('should apply demo mode multiplier (60x)', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: true
      };

      // After 1 second real time = 60 seconds focused time
      const elapsed1s = timer.getElapsedFocusedTime(state, nowMs + 1000);
      expect(elapsed1s).toBe(60000);

      // After 5 seconds real time = 300 seconds (5 minutes) focused time
      const elapsed5s = timer.getElapsedFocusedTime(state, nowMs + 5000);
      expect(elapsed5s).toBe(300000);
    });

    it('should subtract distraction penalty from elapsed time', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 30000, // 30 seconds penalty
        isDemoMode: false
      };

      // After 60 seconds, with 30 seconds penalty = 30 seconds focused
      const elapsed = timer.getElapsedFocusedTime(state, nowMs + 60000);
      expect(elapsed).toBe(30000);
    });

    it('should exclude current hidden duration from elapsed time', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 10000, // Hidden at 10s mark
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // At 30 seconds: 30s total - 20s hidden = 10s focused
      const elapsed = timer.getElapsedFocusedTime(state, nowMs + 30000);
      expect(elapsed).toBe(10000);
    });

    it('should handle both penalty and hidden duration together', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 40000, // Hidden at 40s
        distractionPenaltyMs: 10000, // 10s penalty from previous distraction
        isDemoMode: false
      };

      // At 60s: 60s total - 10s penalty - 20s hidden = 30s focused
      const elapsed = timer.getElapsedFocusedTime(state, nowMs + 60000);
      expect(elapsed).toBe(30000);
    });

    it('should never return negative elapsed time', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 100000, // Large penalty
        isDemoMode: false
      };

      // Penalty exceeds elapsed time, should return 0
      const elapsed = timer.getElapsedFocusedTime(state, nowMs + 50000);
      expect(elapsed).toBe(0);
    });

    it('should return 0 when nowMs is before roundStartAt', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // Query time before round started
      const elapsed = timer.getElapsedFocusedTime(state, nowMs - 1000);
      expect(elapsed).toBe(0);
    });

    it('should apply demo mode multiplier to hidden duration', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 10000, // Hidden at 10s real time
        distractionPenaltyMs: 0,
        isDemoMode: true
      };

      // At 20s real time: 20s * 60 = 1200s total, hidden 10s * 60 = 600s
      // Focused: 1200s - 600s = 600s
      const elapsed = timer.getElapsedFocusedTime(state, nowMs + 20000);
      expect(elapsed).toBe(600000);
    });
  });

  describe('getRemainingTime()', () => {
    it('should calculate remaining time correctly', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000, // 25 minutes
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // After 5 minutes: 25 - 5 = 20 minutes remaining
      const remaining = timer.getRemainingTime(state, nowMs + 5 * 60 * 1000);
      expect(remaining).toBe(20 * 60 * 1000);
    });

    it('should return 0 when time is up', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // After 25 minutes
      const remaining = timer.getRemainingTime(state, nowMs + 25 * 60 * 1000);
      expect(remaining).toBe(0);
    });

    it('should return 0 when time exceeds duration', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // After 30 minutes (5 minutes over)
      const remaining = timer.getRemainingTime(state, nowMs + 30 * 60 * 1000);
      expect(remaining).toBe(0);
    });

    it('should account for distraction penalty in remaining time', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 15 * 60 * 1000, // 15 minutes
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 5 * 60 * 1000, // 5 minutes penalty
        isDemoMode: false
      };

      // After 10 minutes real time, with 5 min penalty = 5 min focused
      // Remaining: 15 - 5 = 10 minutes
      const remaining = timer.getRemainingTime(state, nowMs + 10 * 60 * 1000);
      expect(remaining).toBe(10 * 60 * 1000);
    });

    it('should extend duration when user is currently hidden', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 15 * 60 * 1000, // 15 minutes
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 5 * 60 * 1000, // Hidden at 5 min mark
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // At 15 minutes: 15 min total - 10 min hidden = 5 min focused
      // Remaining: 15 - 5 = 10 minutes
      const remaining = timer.getRemainingTime(state, nowMs + 15 * 60 * 1000);
      expect(remaining).toBe(10 * 60 * 1000);
    });

    it('should work correctly in demo mode', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000, // 25 minutes
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: true
      };

      // After 25 seconds real time = 25 minutes focused time
      const remaining = timer.getRemainingTime(state, nowMs + 25 * 1000);
      expect(remaining).toBe(0);
    });
  });

  describe('markHidden()', () => {
    it('should record hiddenAt timestamp', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      const hideTime = nowMs + 10000;
      const newState = timer.markHidden(state, hideTime);

      expect(newState.hiddenAt).toBe(hideTime);
      expect(newState.roundStartAt).toBe(state.roundStartAt);
      expect(newState.selectedDurationMs).toBe(state.selectedDurationMs);
    });

    it('should not modify other state properties', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs + 5000,
        hiddenAt: null,
        distractionPenaltyMs: 3000,
        isDemoMode: true
      };

      const newState = timer.markHidden(state, nowMs + 10000);

      expect(newState.lastSeenAt).toBe(state.lastSeenAt);
      expect(newState.distractionPenaltyMs).toBe(state.distractionPenaltyMs);
      expect(newState.isDemoMode).toBe(state.isDemoMode);
    });
  });

  describe('markVisible()', () => {
    it('should clear hiddenAt and return hidden duration', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 10000,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      const visibleTime = nowMs + 20000;
      const result = timer.markVisible(state, visibleTime);

      expect(result.state.hiddenAt).toBeNull();
      expect(result.hiddenRealMs).toBe(10000);
      expect(result.hiddenDuration).toBe(10000); // 20000 - 10000
    });

    it('should return 0 duration when hiddenAt is null', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      const result = timer.markVisible(state, nowMs + 10000);

      expect(result.state.hiddenAt).toBeNull();
      expect(result.hiddenRealMs).toBe(0);
      expect(result.hiddenDuration).toBe(0);
    });

    it('should apply demo mode multiplier to hidden duration', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 10000, // Hidden for 10 seconds real time
        distractionPenaltyMs: 0,
        isDemoMode: true
      };

      const visibleTime = nowMs + 20000;
      const result = timer.markVisible(state, visibleTime);

      // 10 seconds * 60 = 600 seconds = 600000 ms
      expect(result.hiddenRealMs).toBe(10000); // Real time: 10 seconds
      expect(result.hiddenDuration).toBe(600000); // Accelerated: 10s * 60
    });

    it('should not modify other state properties', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs + 5000,
        hiddenAt: nowMs + 10000,
        distractionPenaltyMs: 3000,
        isDemoMode: false
      };

      const result = timer.markVisible(state, nowMs + 20000);

      expect(result.state.roundStartAt).toBe(state.roundStartAt);
      expect(result.state.lastSeenAt).toBe(state.lastSeenAt);
      expect(result.state.distractionPenaltyMs).toBe(state.distractionPenaltyMs);
      expect(result.state.isDemoMode).toBe(state.isDemoMode);
    });
  });

  describe('applyDistractionPenalty()', () => {
    it('should add penalty to existing distractionPenaltyMs', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 5000,
        isDemoMode: false
      };

      const newState = timer.applyDistractionPenalty(state, 10000);

      expect(newState.distractionPenaltyMs).toBe(15000);
    });

    it('should work when initial penalty is 0', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      const newState = timer.applyDistractionPenalty(state, 7000);

      expect(newState.distractionPenaltyMs).toBe(7000);
    });

    it('should accumulate multiple penalties', () => {
      const nowMs = 1000000;
      let state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      state = timer.applyDistractionPenalty(state, 3000);
      state = timer.applyDistractionPenalty(state, 5000);
      state = timer.applyDistractionPenalty(state, 2000);

      expect(state.distractionPenaltyMs).toBe(10000);
    });

    it('should not modify other state properties', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs + 5000,
        hiddenAt: nowMs + 10000,
        distractionPenaltyMs: 0,
        isDemoMode: true
      };

      const newState = timer.applyDistractionPenalty(state, 5000);

      expect(newState.roundStartAt).toBe(state.roundStartAt);
      expect(newState.lastSeenAt).toBe(state.lastSeenAt);
      expect(newState.hiddenAt).toBe(state.hiddenAt);
      expect(newState.isDemoMode).toBe(state.isDemoMode);
    });
  });

  describe('updateLastSeen()', () => {
    it('should update lastSeenAt timestamp', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      const updateTime = nowMs + 5000;
      const newState = timer.updateLastSeen(state, updateTime);

      expect(newState.lastSeenAt).toBe(updateTime);
    });

    it('should not modify other state properties', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 3000,
        distractionPenaltyMs: 2000,
        isDemoMode: true
      };

      const newState = timer.updateLastSeen(state, nowMs + 10000);

      expect(newState.roundStartAt).toBe(state.roundStartAt);
      expect(newState.hiddenAt).toBe(state.hiddenAt);
      expect(newState.distractionPenaltyMs).toBe(state.distractionPenaltyMs);
      expect(newState.isDemoMode).toBe(state.isDemoMode);
    });

    it('should allow updating multiple times', () => {
      const nowMs = 1000000;
      let state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      state = timer.updateLastSeen(state, nowMs + 5000);
      expect(state.lastSeenAt).toBe(nowMs + 5000);

      state = timer.updateLastSeen(state, nowMs + 10000);
      expect(state.lastSeenAt).toBe(nowMs + 10000);

      state = timer.updateLastSeen(state, nowMs + 15000);
      expect(state.lastSeenAt).toBe(nowMs + 15000);
    });
  });

  describe('isComplete()', () => {
    it('should return false when time remaining', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // After 10 minutes
      expect(timer.isComplete(state, nowMs + 10 * 60 * 1000)).toBe(false);
    });

    it('should return true when time is exactly up', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // After exactly 25 minutes
      expect(timer.isComplete(state, nowMs + 25 * 60 * 1000)).toBe(true);
    });

    it('should return true when time exceeded', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // After 30 minutes (5 minutes over)
      expect(timer.isComplete(state, nowMs + 30 * 60 * 1000)).toBe(true);
    });

    it('should account for distraction penalty', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 15 * 60 * 1000, // 15 minutes
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 5 * 60 * 1000, // 5 minutes penalty
        isDemoMode: false
      };

      // After 15 minutes real time, but only 10 minutes focused
      expect(timer.isComplete(state, nowMs + 15 * 60 * 1000)).toBe(false);

      // After 20 minutes real time, 15 minutes focused
      expect(timer.isComplete(state, nowMs + 20 * 60 * 1000)).toBe(true);
    });

    it('should account for hidden duration', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 15 * 60 * 1000, // 15 minutes
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 10 * 60 * 1000, // Hidden at 10 min mark
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // At 15 minutes: 15 min total - 5 min hidden = 10 min focused
      expect(timer.isComplete(state, nowMs + 15 * 60 * 1000)).toBe(false);

      // At 25 minutes: 25 min total - 15 min hidden = 10 min focused
      expect(timer.isComplete(state, nowMs + 25 * 60 * 1000)).toBe(false);
    });

    it('should work correctly in demo mode', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 15 * 60 * 1000, // 15 minutes
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: true
      };

      // After 10 seconds real time = 10 minutes focused
      expect(timer.isComplete(state, nowMs + 10 * 1000)).toBe(false);

      // After 15 seconds real time = 15 minutes focused
      expect(timer.isComplete(state, nowMs + 15 * 1000)).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle hidden + penalty + demo mode together', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 15 * 60 * 1000, // 15 minutes
        lastSeenAt: nowMs,
        hiddenAt: nowMs + 2000, // Hidden at 2s real time
        distractionPenaltyMs: 3 * 60 * 1000, // 3 minutes penalty
        isDemoMode: true
      };

      // At 5s real time:
      // Total: 5s * 60 = 300s (5 min)
      // Hidden: 3s * 60 = 180s (3 min)
      // Penalty: 3 min
      // Focused: 5min - 3min - 3min = -1min → 0min
      const elapsed = timer.getElapsedFocusedTime(state, nowMs + 5000);
      expect(elapsed).toBe(0);

      // At 10s real time:
      // Total: 10s * 60 = 600s (10 min)
      // Hidden: 8s * 60 = 480s (8 min)
      // Penalty: 3 min
      // Focused: 10min - 8min - 3min = -1min → 0min
      const elapsed2 = timer.getElapsedFocusedTime(state, nowMs + 10000);
      expect(elapsed2).toBe(0);
    });

    it('should handle complete round flow simulation', () => {
      const nowMs = 1000000;
      
      // Start a 15-minute round in demo mode
      let state = timer.start(15, true);
      expect(state.isDemoMode).toBe(true);
      
      // After 5 seconds (5 minutes in demo mode)
      state = timer.updateLastSeen(state, state.roundStartAt + 5000);
      let elapsed = timer.getElapsedFocusedTime(state, state.roundStartAt + 5000);
      expect(elapsed).toBe(5 * 60 * 1000);
      expect(timer.isComplete(state, state.roundStartAt + 5000)).toBe(false);
      
      // User hides tab at 5s
      state = timer.markHidden(state, state.roundStartAt + 5000);
      
      // User returns at 10s (5s hidden, but only 0.083s in demo time = 5s)
      const { state: visibleState, hiddenRealMs, hiddenDuration } = timer.markVisible(
        state,
        state.roundStartAt + 10000
      );
      state = visibleState;
      
      // Hidden duration: 5s * 60 = 300s = 5 min in demo mode
      expect(hiddenDuration).toBe(5 * 60 * 1000);
      
      // Check if distraction should trigger (> 5s threshold)
      const shouldTrigger = hiddenDuration > Config.distractionThreshold * 1000;
      expect(shouldTrigger).toBe(true);
      
      // Apply the distraction penalty
      state = timer.applyDistractionPenalty(state, hiddenDuration);
      
      // At 15s real time (15 min demo time):
      // Total: 15s * 60 = 900s (15 min)
      // Penalty: 5 min
      // Focused: 15min - 5min = 10min
      elapsed = timer.getElapsedFocusedTime(state, state.roundStartAt + 15000);
      expect(elapsed).toBe(10 * 60 * 1000);
      
      // Complete at 20s (20 min demo time, with 5 min penalty = 15 min focused)
      expect(timer.isComplete(state, state.roundStartAt + 20000)).toBe(true);
    });

    it('should handle multiple distraction events', () => {
      const nowMs = 1000000;
      let state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };
      
      // First distraction: hide for 10 seconds
      state = timer.markHidden(state, nowMs + 60000); // At 1 min
      const { state: visible1, hiddenRealMs, hiddenDuration: hidden1 } = timer.markVisible(
        state,
        nowMs + 70000
      ); // At 1 min 10s
      state = visible1;
      state = timer.applyDistractionPenalty(state, hidden1);
      
      // Second distraction: hide for 15 seconds
      state = timer.markHidden(state, nowMs + 180000); // At 3 min
      const { state: visible2, hiddenRealMs: hiddenRealMs2, hiddenDuration: hidden2 } = timer.markVisible(
        state,
        nowMs + 195000
      ); // At 3 min 15s
      state = visible2;
      state = timer.applyDistractionPenalty(state, hidden2);
      
      // Total penalty: 10s + 15s = 25s
      expect(state.distractionPenaltyMs).toBe(25000);
      
      // At 5 minutes: 5min - 25s = 4min 35s focused
      const elapsed = timer.getElapsedFocusedTime(state, nowMs + 5 * 60 * 1000);
      expect(elapsed).toBe((5 * 60 - 25) * 1000);
    });

    it('should handle boundary case: completion exactly at threshold', () => {
      const nowMs = 1000000;
      const state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 1000, // 1 second
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };

      // Just before completion
      expect(timer.isComplete(state, nowMs + 999)).toBe(false);
      
      // Exactly at completion
      expect(timer.isComplete(state, nowMs + 1000)).toBe(true);
      
      // Just after completion
      expect(timer.isComplete(state, nowMs + 1001)).toBe(true);
    });

    it('should handle lastSeenAt for recovery after page close', () => {
      const nowMs = 1000000;
      let state: TimerState = {
        roundStartAt: nowMs,
        selectedDurationMs: 25 * 60 * 1000,
        lastSeenAt: nowMs,
        hiddenAt: null,
        distractionPenaltyMs: 0,
        isDemoMode: false
      };
      
      // Update lastSeenAt at 5 minutes
      state = timer.updateLastSeen(state, nowMs + 5 * 60 * 1000);
      
      // Simulate page close (user was last seen at 5 min)
      // When reopening, we use lastSeenAt to calculate preserved depth
      const focusedUntilLastSeen = timer.getElapsedFocusedTime(
        state,
        state.lastSeenAt
      );
      expect(focusedUntilLastSeen).toBe(5 * 60 * 1000);
      
      // Ensure it doesn't exceed selected duration
      const cappedTime = Math.min(focusedUntilLastSeen, state.selectedDurationMs);
      expect(cappedTime).toBe(5 * 60 * 1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', () => {
      const state = timer.start(0, false);
      expect(state.selectedDurationMs).toBe(0);
      expect(timer.isComplete(state, state.roundStartAt)).toBe(true);
    });

    it('should handle very large durations', () => {
      const state = timer.start(1000, false); // 1000 minutes
      expect(state.selectedDurationMs).toBe(1000 * 60 * 1000);
      expect(timer.isComplete(state, state.roundStartAt + 100 * 60 * 1000)).toBe(false);
    });

    it('should handle rapid hide/show cycles', () => {
      const nowMs = 1000000;
      let state = timer.start(25, false);
      
      // Hide and show quickly (< 1 second)
      state = timer.markHidden(state, nowMs + 1000);
      const { state: newState, hiddenRealMs, hiddenDuration } = timer.markVisible(state, nowMs + 1500);
      
      expect(hiddenDuration).toBe(500);
      expect(newState.hiddenAt).toBeNull();
    });

    it('should handle calling markVisible when not hidden', () => {
      const nowMs = 1000000;
      const state = timer.start(25, false);
      
      const result = timer.markVisible(state, nowMs + 5000);
      
      expect(result.state).toEqual(state);
      expect(result.hiddenDuration).toBe(0);
    });

    it('should handle calling markHidden multiple times', () => {
      const nowMs = 1000000;
      let state = timer.start(25, false);
      
      state = timer.markHidden(state, nowMs + 1000);
      state = timer.markHidden(state, nowMs + 2000); // Second hide overwrites
      
      expect(state.hiddenAt).toBe(nowMs + 2000);
    });

    it('should handle negative penalty (should not happen, but testing robustness)', () => {
      const nowMs = 1000000;
      const state = timer.start(25, false);
      
      const newState = timer.applyDistractionPenalty(state, -1000);
      
      // Penalty still accumulated (implementation doesn't validate negative)
      expect(newState.distractionPenaltyMs).toBe(-1000);
      
      // But elapsed time should still be non-negative
      const elapsed = timer.getElapsedFocusedTime(newState, nowMs + 10000);
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });
});
