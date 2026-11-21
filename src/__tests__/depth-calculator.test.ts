/**
 * Depth Calculator Module Unit Tests
 * 
 * Tests for depth calculation, zone determination, rise penalties,
 * and depth state management including round completion and abandonment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createDepthCalculator, 
  createInitialDepthState,
  type DepthState,
  type DepthCalculator 
} from '../depth-calculator';
import { Config } from '../config';

describe('DepthCalculator', () => {
  let calculator: DepthCalculator;
  let initialState: DepthState;

  beforeEach(() => {
    calculator = createDepthCalculator();
    initialState = createInitialDepthState();
  });

  describe('calculateDescent', () => {
    it('should calculate descent for 1 minute (12m)', () => {
      const focusedTimeMs = 1 * 60 * 1000; // 1 分鐘
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(12);
    });

    it('should calculate descent for 25 minutes (300m)', () => {
      const focusedTimeMs = 25 * 60 * 1000; // 25 分鐘
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(300);
    });

    it('should calculate descent for 0 minutes (0m)', () => {
      const focusedTimeMs = 0;
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(0);
    });

    it('should calculate descent for 5 minutes (60m)', () => {
      const focusedTimeMs = 5 * 60 * 1000; // 5 分鐘
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(60);
    });

    it('should calculate descent for 15 minutes (180m)', () => {
      const focusedTimeMs = 15 * 60 * 1000; // 15 分鐘
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(180);
    });

    it('should calculate descent for 45 minutes (540m)', () => {
      const focusedTimeMs = 45 * 60 * 1000; // 45 分鐘
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(540);
    });

    it('should handle fractional minutes correctly', () => {
      const focusedTimeMs = 2.5 * 60 * 1000; // 2.5 分鐘
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(30);
    });
  });

  describe('getZone', () => {
    it('should return Sunlit for 0m depth', () => {
      expect(calculator.getZone(0)).toBe('Sunlit');
    });

    it('should return Sunlit for 199m depth (just below boundary)', () => {
      expect(calculator.getZone(199)).toBe('Sunlit');
    });

    it('should return Twilight for 200m depth (boundary)', () => {
      expect(calculator.getZone(200)).toBe('Twilight');
    });

    it('should return Twilight for 999m depth (just below boundary)', () => {
      expect(calculator.getZone(999)).toBe('Twilight');
    });

    it('should return Midnight for 1000m depth (boundary)', () => {
      expect(calculator.getZone(1000)).toBe('Midnight');
    });

    it('should return Midnight for 3999m depth (just below boundary)', () => {
      expect(calculator.getZone(3999)).toBe('Midnight');
    });

    it('should return Abyssal for 4000m depth (boundary)', () => {
      expect(calculator.getZone(4000)).toBe('Abyssal');
    });

    it('should return Abyssal for 5999m depth (just below boundary)', () => {
      expect(calculator.getZone(5999)).toBe('Abyssal');
    });

    it('should return Hadal for 6000m depth (boundary)', () => {
      expect(calculator.getZone(6000)).toBe('Hadal');
    });

    it('should return Hadal for 10900m depth (target)', () => {
      expect(calculator.getZone(10900)).toBe('Hadal');
    });

    it('should return Hadal for depths beyond target', () => {
      expect(calculator.getZone(15000)).toBe('Hadal');
    });
  });

  describe('calculateRisePenalty', () => {
    it('should calculate 20% penalty for single distraction', () => {
      const currentDescent = 100;
      const penalty = calculator.calculateRisePenalty(currentDescent);
      expect(penalty).toBe(20);
    });

    it('should calculate 20% penalty for 300m descent', () => {
      const currentDescent = 300;
      const penalty = calculator.calculateRisePenalty(currentDescent);
      expect(penalty).toBe(60);
    });

    it('should return 0 for 0m descent', () => {
      const currentDescent = 0;
      const penalty = calculator.calculateRisePenalty(currentDescent);
      expect(penalty).toBe(0);
    });
  });

  describe('applyRisePenalty', () => {
    it('should add penalty to roundRisePenalty', () => {
      const state: DepthState = {
        ...initialState,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      const penalty = 20;
      const newState = calculator.applyRisePenalty(state, penalty);
      expect(newState.roundRisePenalty).toBe(20);
    });

    it('should accumulate multiple penalties', () => {
      let state: DepthState = {
        ...initialState,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      state = calculator.applyRisePenalty(state, 20);
      state = calculator.applyRisePenalty(state, 20);
      expect(state.roundRisePenalty).toBe(40);
    });

    it('should cap penalty at 50% of roundDescentDepth', () => {
      const state: DepthState = {
        ...initialState,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      // Apply 3 penalties: 20 + 20 + 20 = 60, but cap at 50
      let newState = calculator.applyRisePenalty(state, 20);
      newState = calculator.applyRisePenalty(newState, 20);
      newState = calculator.applyRisePenalty(newState, 20);
      expect(newState.roundRisePenalty).toBe(50); // 50% of 100
    });

    it('should cap penalty at 50% even with large single penalty', () => {
      const state: DepthState = {
        ...initialState,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      const newState = calculator.applyRisePenalty(state, 80);
      expect(newState.roundRisePenalty).toBe(50); // Capped at 50
    });

    it('should handle multiple distractions with 50% cap', () => {
      let state: DepthState = {
        ...initialState,
        roundDescentDepth: 300,
        roundRisePenalty: 0
      };
      // 300m descent, each penalty 60m (20%)
      // 60 + 60 + 60 = 180, but cap at 150 (50%)
      state = calculator.applyRisePenalty(state, 60);
      state = calculator.applyRisePenalty(state, 60);
      state = calculator.applyRisePenalty(state, 60);
      expect(state.roundRisePenalty).toBe(150); // 50% of 300
    });
  });

  describe('getCurrentTotalDepth', () => {
    it('should return roundStartDepth when no descent', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      };
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(100);
    });

    it('should add net descent to roundStartDepth', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 50,
        roundRisePenalty: 0
      };
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(150);
    });

    it('should subtract penalty from descent', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 100,
        roundRisePenalty: 20
      };
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(180); // 100 + (100 - 20)
    });

    it('should never go below roundStartDepth', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 50,
        roundRisePenalty: 60 // More than descent
      };
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(100); // Can't go below start
    });

    it('should cap at targetDepth (10900m)', () => {
      const state: DepthState = {
        totalDepth: 10850,
        roundStartDepth: 10850,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(10900); // Capped at target
    });

    it('should handle reaching exactly 10900m', () => {
      const state: DepthState = {
        totalDepth: 10850,
        roundStartDepth: 10850,
        roundDescentDepth: 50,
        roundRisePenalty: 0
      };
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(10900);
    });
  });

  describe('commitRound', () => {
    it('should add net descent to totalDepth', () => {
      const state: DepthState = {
        totalDepth: 0,
        roundStartDepth: 0,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      const newState = calculator.commitRound(state);
      expect(newState.totalDepth).toBe(100);
      expect(newState.roundStartDepth).toBe(100);
    });

    it('should reset round descent and penalty', () => {
      const state: DepthState = {
        totalDepth: 0,
        roundStartDepth: 0,
        roundDescentDepth: 100,
        roundRisePenalty: 20
      };
      const newState = calculator.commitRound(state);
      expect(newState.roundDescentDepth).toBe(0);
      expect(newState.roundRisePenalty).toBe(0);
    });

    it('should accumulate depth over multiple rounds', () => {
      let state = initialState;
      
      // Round 1: 180m
      state = { ...state, roundDescentDepth: 180 };
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(180);
      
      // Round 2: 300m
      state = { ...state, roundDescentDepth: 300 };
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(480);
      
      // Round 3: 180m
      state = { ...state, roundDescentDepth: 180 };
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(660);
    });

    it('should handle penalties when committing', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 100,
        roundRisePenalty: 30
      };
      const newState = calculator.commitRound(state);
      expect(newState.totalDepth).toBe(170); // 100 + (100 - 30)
    });

    it('should cap at targetDepth when committing', () => {
      const state: DepthState = {
        totalDepth: 10850,
        roundStartDepth: 10850,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      const newState = calculator.commitRound(state);
      expect(newState.totalDepth).toBe(10900);
    });
  });

  describe('abandonRound', () => {
    it('should preserve current depth progress', () => {
      const state: DepthState = {
        totalDepth: 0,
        roundStartDepth: 0,
        roundDescentDepth: 60,
        roundRisePenalty: 0
      };
      const newState = calculator.abandonRound(state);
      expect(newState.totalDepth).toBe(60);
      expect(newState.roundStartDepth).toBe(60);
    });

    it('should reset round descent and penalty', () => {
      const state: DepthState = {
        totalDepth: 0,
        roundStartDepth: 0,
        roundDescentDepth: 100,
        roundRisePenalty: 20
      };
      const newState = calculator.abandonRound(state);
      expect(newState.roundDescentDepth).toBe(0);
      expect(newState.roundRisePenalty).toBe(0);
    });

    it('should preserve depth with penalties applied', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 100,
        roundRisePenalty: 30
      };
      const newState = calculator.abandonRound(state);
      expect(newState.totalDepth).toBe(170); // 100 + (100 - 30)
    });

    it('should not go below roundStartDepth when penalty exceeds descent', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 50,
        roundRisePenalty: 60
      };
      const newState = calculator.abandonRound(state);
      expect(newState.totalDepth).toBe(100); // Can't go below start
    });
  });

  describe('resetDepth', () => {
    it('should reset all depth values to 0', () => {
      const state: DepthState = {
        totalDepth: 5000,
        roundStartDepth: 5000,
        roundDescentDepth: 100,
        roundRisePenalty: 20
      };
      const newState = calculator.resetDepth(state);
      expect(newState.totalDepth).toBe(0);
      expect(newState.roundStartDepth).toBe(0);
      expect(newState.roundDescentDepth).toBe(0);
      expect(newState.roundRisePenalty).toBe(0);
    });

    it('should reset from any depth state', () => {
      const state: DepthState = {
        totalDepth: 10900,
        roundStartDepth: 10900,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      };
      const newState = calculator.resetDepth(state);
      expect(newState.totalDepth).toBe(0);
    });
  });

  describe('hasReachedTarget', () => {
    it('should return false for depths below target', () => {
      expect(calculator.hasReachedTarget(10899)).toBe(false);
      expect(calculator.hasReachedTarget(5000)).toBe(false);
      expect(calculator.hasReachedTarget(0)).toBe(false);
    });

    it('should return true for target depth', () => {
      expect(calculator.hasReachedTarget(10900)).toBe(true);
    });

    it('should return true for depths beyond target', () => {
      expect(calculator.hasReachedTarget(10901)).toBe(true);
      expect(calculator.hasReachedTarget(15000)).toBe(true);
    });
  });

  describe('updateRoundDescent', () => {
    it('should update roundDescentDepth based on focused time', () => {
      const state = initialState;
      const focusedTimeMs = 5 * 60 * 1000; // 5 minutes = 60m
      const newState = calculator.updateRoundDescent(state, focusedTimeMs);
      expect(newState.roundDescentDepth).toBe(60);
    });

    it('should not affect other state values', () => {
      const state: DepthState = {
        totalDepth: 100,
        roundStartDepth: 100,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      };
      const focusedTimeMs = 10 * 60 * 1000; // 10 minutes = 120m
      const newState = calculator.updateRoundDescent(state, focusedTimeMs);
      expect(newState.totalDepth).toBe(100);
      expect(newState.roundStartDepth).toBe(100);
      expect(newState.roundRisePenalty).toBe(0);
      expect(newState.roundDescentDepth).toBe(120);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple rounds with distractions', () => {
      let state = initialState;
      
      // Round 1: 15 min (180m), 1 distraction (20% = 36m), net: 144m
      state = { ...state, roundDescentDepth: 180 };
      const penalty1 = calculator.calculateRisePenalty(180);
      state = calculator.applyRisePenalty(state, penalty1);
      expect(state.roundRisePenalty).toBe(36);
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(144);
      
      // Round 2: 25 min (300m), no distraction, net: 300m
      state = { ...state, roundDescentDepth: 300 };
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(444);
      
      // Round 3: 25 min (300m), 2 distractions (60m + 60m = 120m), net: 180m
      state = { ...state, roundDescentDepth: 300 };
      const penalty3a = calculator.calculateRisePenalty(300);
      state = calculator.applyRisePenalty(state, penalty3a);
      const penalty3b = calculator.calculateRisePenalty(300);
      state = calculator.applyRisePenalty(state, penalty3b);
      expect(state.roundRisePenalty).toBe(120);
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(624);
    });

    it('should handle zone transitions across multiple rounds', () => {
      let state = initialState;
      
      // Start in Sunlit (0m)
      expect(calculator.getZone(state.totalDepth)).toBe('Sunlit');
      
      // Round 1: reach Twilight (200m)
      state = { ...state, roundDescentDepth: 200 };
      state = calculator.commitRound(state);
      expect(calculator.getZone(state.totalDepth)).toBe('Twilight');
      
      // Round 2: reach Midnight (1000m)
      state = { ...state, roundDescentDepth: 800 };
      state = calculator.commitRound(state);
      expect(calculator.getZone(state.totalDepth)).toBe('Midnight');
      
      // Round 3: reach Abyssal (4000m)
      state = { ...state, roundDescentDepth: 3000 };
      state = calculator.commitRound(state);
      expect(calculator.getZone(state.totalDepth)).toBe('Abyssal');
      
      // Round 4: reach Hadal (6000m)
      state = { ...state, roundDescentDepth: 2000 };
      state = calculator.commitRound(state);
      expect(calculator.getZone(state.totalDepth)).toBe('Hadal');
    });

    it('should handle reaching target depth with penalties', () => {
      let state: DepthState = {
        totalDepth: 10800,
        roundStartDepth: 10800,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      };
      
      // 25 min = 300m, but with 3 distractions reaching 50% cap (150m)
      // Net: 150m, reaching 10950m but capped at 10900m
      state = { ...state, roundDescentDepth: 300 };
      state = calculator.applyRisePenalty(state, 60);
      state = calculator.applyRisePenalty(state, 60);
      state = calculator.applyRisePenalty(state, 60);
      expect(state.roundRisePenalty).toBe(150);
      
      const currentTotal = calculator.getCurrentTotalDepth(state);
      expect(currentTotal).toBe(10900);
      
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(10900);
      expect(calculator.hasReachedTarget(state.totalDepth)).toBe(true);
    });

    it('should handle dive again after reaching target', () => {
      let state: DepthState = {
        totalDepth: 10900,
        roundStartDepth: 10900,
        roundDescentDepth: 0,
        roundRisePenalty: 0
      };
      
      // Reset depth (dive again)
      state = calculator.resetDepth(state);
      expect(state.totalDepth).toBe(0);
      expect(calculator.getZone(state.totalDepth)).toBe('Sunlit');
      
      // Can start descending again
      state = { ...state, roundDescentDepth: 180 };
      state = calculator.commitRound(state);
      expect(state.totalDepth).toBe(180);
    });

    it('should handle abandoned round with partial progress', () => {
      let state = initialState;
      
      // Start a round, descend 5 minutes (60m)
      state = { ...state, roundDescentDepth: 60 };
      
      // Abandon - should keep the 60m
      state = calculator.abandonRound(state);
      expect(state.totalDepth).toBe(60);
      expect(state.roundStartDepth).toBe(60);
      expect(state.roundDescentDepth).toBe(0);
    });

    it('should handle maximum distraction scenario (50% cap)', () => {
      let state: DepthState = {
        ...initialState,
        roundDescentDepth: 300
      };
      
      // Apply 5 distractions: 60 + 60 + 60 + 60 + 60 = 300
      // But capped at 150 (50%)
      for (let i = 0; i < 5; i++) {
        const penalty = calculator.calculateRisePenalty(300);
        state = calculator.applyRisePenalty(state, penalty);
      }
      
      expect(state.roundRisePenalty).toBe(150);
      
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(150); // 0 + (300 - 150)
    });

    it('should preserve depth floor across distraction penalties', () => {
      let state: DepthState = {
        totalDepth: 1000,
        roundStartDepth: 1000,
        roundDescentDepth: 100,
        roundRisePenalty: 0
      };
      
      // Apply excessive penalties that would go negative
      state = calculator.applyRisePenalty(state, 30);
      state = calculator.applyRisePenalty(state, 30);
      expect(state.roundRisePenalty).toBe(50); // Capped at 50% of 100
      
      const total = calculator.getCurrentTotalDepth(state);
      expect(total).toBe(1050); // 1000 + (100 - 50)
      expect(total).toBeGreaterThanOrEqual(state.roundStartDepth);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero time', () => {
      const descent = calculator.calculateDescent(0);
      expect(descent).toBe(0);
    });

    it('should handle very small time values', () => {
      const focusedTimeMs = 1000; // 1 second
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBeCloseTo(0.2, 1); // 1/60 * 12 = 0.2
    });

    it('should handle very large time values', () => {
      const focusedTimeMs = 1000 * 60 * 1000; // 1000 minutes
      const descent = calculator.calculateDescent(focusedTimeMs);
      expect(descent).toBe(12000);
    });

    it('should handle depth exactly at zone boundaries', () => {
      expect(calculator.getZone(200)).toBe('Twilight');
      expect(calculator.getZone(1000)).toBe('Midnight');
      expect(calculator.getZone(4000)).toBe('Abyssal');
      expect(calculator.getZone(6000)).toBe('Hadal');
    });

    it('should handle depth one meter below zone boundaries', () => {
      expect(calculator.getZone(199)).toBe('Sunlit');
      expect(calculator.getZone(999)).toBe('Twilight');
      expect(calculator.getZone(3999)).toBe('Midnight');
      expect(calculator.getZone(5999)).toBe('Abyssal');
    });
  });
});
