/**
 * State Machine Unit Tests
 * 
 * Tests all legal and illegal state transitions, boundary cases,
 * and parameter validation for the state machine module.
 * 
 * Validates: Requirements 3.2-3.13
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AppState,
  StateTransitionEvent,
  StateMachine,
  createStateMachine
} from '../state-machine';

describe('State Machine', () => {
  let stateMachine: StateMachine;
  
  beforeEach(() => {
    stateMachine = createStateMachine();
  });
  
  describe('Initial State', () => {
    it('should start in IDLE state by default', () => {
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should allow custom initial state', () => {
      const customMachine = createStateMachine(AppState.FOCUSING);
      expect(customMachine.getState()).toBe(AppState.FOCUSING);
    });
  });
  
  describe('Legal Transitions from IDLE', () => {
    it('should transition IDLE → FOCUSING on START_FOCUS with valid duration', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 25
      });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.FOCUSING);
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
    
    it('should allow IDLE → IDLE on DIVE_AGAIN (no-op transition)', () => {
      const result = stateMachine.transition({ type: 'DIVE_AGAIN' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('Legal Transitions from FOCUSING', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
    });
    
    it('should transition FOCUSING → DISTRACTED on DISTRACTION_DETECTED', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.DISTRACTED);
      expect(stateMachine.getState()).toBe(AppState.DISTRACTED);
    });
    
    it('should transition FOCUSING → SHORT_BREAK on ROUND_COMPLETE (not ending, not long break)', () => {
      const result = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: false
      });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.SHORT_BREAK);
      expect(stateMachine.getState()).toBe(AppState.SHORT_BREAK);
    });
    
    it('should transition FOCUSING → LONG_BREAK on ROUND_COMPLETE (not ending, is long break)', () => {
      const result = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: true
      });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.LONG_BREAK);
      expect(stateMachine.getState()).toBe(AppState.LONG_BREAK);
    });
    
    it('should transition FOCUSING → ENDING on ROUND_COMPLETE (is ending)', () => {
      const result = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: true,
        isLongBreak: false
      });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.ENDING);
      expect(stateMachine.getState()).toBe(AppState.ENDING);
    });
    
    it('should prioritize ENDING over LONG_BREAK when shouldShowEnding is true', () => {
      const result = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: true,
        isLongBreak: true
      });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.ENDING);
    });
    
    it('should transition FOCUSING → IDLE on ABANDON_ROUND', () => {
      const result = stateMachine.transition({ type: 'ABANDON_ROUND' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('Legal Transitions from DISTRACTED', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
    });
    
    it('should transition DISTRACTED → FOCUSING on DISTRACTION_ANIMATION_COMPLETE', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_ANIMATION_COMPLETE' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.FOCUSING);
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
    
    it('should transition DISTRACTED → IDLE on ABANDON_ROUND', () => {
      const result = stateMachine.transition({ type: 'ABANDON_ROUND' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('Legal Transitions from SHORT_BREAK', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: false
      });
    });
    
    it('should transition SHORT_BREAK → IDLE on BREAK_COMPLETE', () => {
      const result = stateMachine.transition({ type: 'BREAK_COMPLETE' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should transition SHORT_BREAK → IDLE on SKIP_BREAK', () => {
      const result = stateMachine.transition({ type: 'SKIP_BREAK' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('Legal Transitions from LONG_BREAK', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: true
      });
    });
    
    it('should transition LONG_BREAK → IDLE on BREAK_COMPLETE', () => {
      const result = stateMachine.transition({ type: 'BREAK_COMPLETE' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should transition LONG_BREAK → IDLE on SKIP_BREAK', () => {
      const result = stateMachine.transition({ type: 'SKIP_BREAK' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('Legal Transitions from ENDING', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: true,
        isLongBreak: false
      });
    });
    
    it('should transition ENDING → IDLE on ENDING_CONFIRMED', () => {
      const result = stateMachine.transition({ type: 'ENDING_CONFIRMED' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should transition ENDING → IDLE on DIVE_AGAIN', () => {
      const result = stateMachine.transition({ type: 'DIVE_AGAIN' });
      
      expect(result.success).toBe(true);
      expect(result.newState).toBe(AppState.IDLE);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('Illegal Transitions from IDLE', () => {
    it('should reject IDLE → DISTRACTED', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should reject IDLE → SHORT_BREAK', () => {
      const result = stateMachine.transition({ type: 'BREAK_COMPLETE' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should reject IDLE → ENDING', () => {
      const result = stateMachine.transition({ type: 'ENDING_CONFIRMED' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should reject IDLE with ROUND_COMPLETE', () => {
      const result = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: false
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('Illegal Transitions from FOCUSING', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
    });
    
    it('should reject FOCUSING → FOCUSING (duplicate START_FOCUS)', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 15
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
    
    it('should reject FOCUSING with BREAK_COMPLETE', () => {
      const result = stateMachine.transition({ type: 'BREAK_COMPLETE' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
    
    it('should reject FOCUSING with SKIP_BREAK', () => {
      const result = stateMachine.transition({ type: 'SKIP_BREAK' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
    
    it('should reject FOCUSING with ENDING_CONFIRMED', () => {
      const result = stateMachine.transition({ type: 'ENDING_CONFIRMED' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
    
    it('should reject FOCUSING with DISTRACTION_ANIMATION_COMPLETE', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_ANIMATION_COMPLETE' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
  });
  
  describe('Illegal Transitions from DISTRACTED', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
    });
    
    it('should reject DISTRACTED → SHORT_BREAK', () => {
      const result = stateMachine.transition({ type: 'BREAK_COMPLETE' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.DISTRACTED);
    });
    
    it('should reject DISTRACTED with START_FOCUS', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 15
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.DISTRACTED);
    });
    
    it('should reject DISTRACTED with ROUND_COMPLETE', () => {
      const result = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: false
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.DISTRACTED);
    });
    
    it('should reject DISTRACTED with DISTRACTION_DETECTED (duplicate)', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.DISTRACTED);
    });
  });
  
  describe('Illegal Transitions from SHORT_BREAK', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: false
      });
    });
    
    it('should reject SHORT_BREAK with START_FOCUS', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 15
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.SHORT_BREAK);
    });
    
    it('should reject SHORT_BREAK with DISTRACTION_DETECTED', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.SHORT_BREAK);
    });
    
    it('should reject SHORT_BREAK with ABANDON_ROUND', () => {
      const result = stateMachine.transition({ type: 'ABANDON_ROUND' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.SHORT_BREAK);
    });
  });
  
  describe('Illegal Transitions from LONG_BREAK', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: true
      });
    });
    
    it('should reject LONG_BREAK with START_FOCUS', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 15
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.LONG_BREAK);
    });
    
    it('should reject LONG_BREAK with DISTRACTION_DETECTED', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.LONG_BREAK);
    });
    
    it('should reject LONG_BREAK with ABANDON_ROUND', () => {
      const result = stateMachine.transition({ type: 'ABANDON_ROUND' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.LONG_BREAK);
    });
  });
  
  describe('Illegal Transitions from ENDING', () => {
    beforeEach(() => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: true,
        isLongBreak: false
      });
    });
    
    it('should reject ENDING with START_FOCUS', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 15
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.ENDING);
    });
    
    it('should reject ENDING with DISTRACTION_DETECTED', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.ENDING);
    });
    
    it('should reject ENDING with ABANDON_ROUND', () => {
      const result = stateMachine.transition({ type: 'ABANDON_ROUND' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.ENDING);
    });
    
    it('should reject ENDING with BREAK_COMPLETE', () => {
      const result = stateMachine.transition({ type: 'BREAK_COMPLETE' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(stateMachine.getState()).toBe(AppState.ENDING);
    });
  });
  
  describe('Parameter Validation', () => {
    it('should reject START_FOCUS with zero duration', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 0
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid duration');
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should reject START_FOCUS with negative duration', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: -10
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid duration');
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should accept START_FOCUS with positive duration', () => {
      const result = stateMachine.transition({
        type: 'START_FOCUS',
        durationMinutes: 0.1
      });
      
      expect(result.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
    });
  });
  
  describe('Boundary Cases', () => {
    it('should handle repeated DIVE_AGAIN in IDLE state', () => {
      const result1 = stateMachine.transition({ type: 'DIVE_AGAIN' });
      const result2 = stateMachine.transition({ type: 'DIVE_AGAIN' });
      const result3 = stateMachine.transition({ type: 'DIVE_AGAIN' });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should handle DISTRACTED → FOCUSING → DISTRACTED cycle', () => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      
      const result1 = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      expect(result1.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.DISTRACTED);
      
      const result2 = stateMachine.transition({ type: 'DISTRACTION_ANIMATION_COMPLETE' });
      expect(result2.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
      
      const result3 = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      expect(result3.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.DISTRACTED);
    });
    
    it('should handle complete round flow: IDLE → FOCUSING → SHORT_BREAK → IDLE', () => {
      const r1 = stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      expect(r1.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.FOCUSING);
      
      const r2 = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: false,
        isLongBreak: false
      });
      expect(r2.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.SHORT_BREAK);
      
      const r3 = stateMachine.transition({ type: 'BREAK_COMPLETE' });
      expect(r3.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should handle complete ending flow: IDLE → FOCUSING → ENDING → IDLE', () => {
      const r1 = stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      expect(r1.success).toBe(true);
      
      const r2 = stateMachine.transition({
        type: 'ROUND_COMPLETE',
        shouldShowEnding: true,
        isLongBreak: false
      });
      expect(r2.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.ENDING);
      
      const r3 = stateMachine.transition({ type: 'DIVE_AGAIN' });
      expect(r3.success).toBe(true);
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
  });
  
  describe('canTransition Method', () => {
    it('should return true for legal transitions', () => {
      expect(stateMachine.canTransition({
        type: 'START_FOCUS',
        durationMinutes: 25
      })).toBe(true);
    });
    
    it('should return false for illegal transitions', () => {
      expect(stateMachine.canTransition({ type: 'DISTRACTION_DETECTED' })).toBe(false);
    });
    
    it('should not modify state when checking transitions', () => {
      stateMachine.canTransition({ type: 'START_FOCUS', durationMinutes: 25 });
      expect(stateMachine.getState()).toBe(AppState.IDLE);
    });
    
    it('should match transition result', () => {
      const event: StateTransitionEvent = { type: 'START_FOCUS', durationMinutes: 25 };
      const canTransition = stateMachine.canTransition(event);
      const result = stateMachine.transition(event);
      
      expect(canTransition).toBe(result.success);
    });
  });
  
  describe('State Preservation on Failed Transitions', () => {
    it('should keep current state when transition fails', () => {
      stateMachine.transition({ type: 'START_FOCUS', durationMinutes: 25 });
      const stateBefore = stateMachine.getState();
      
      stateMachine.transition({ type: 'BREAK_COMPLETE' });
      
      expect(stateMachine.getState()).toBe(stateBefore);
    });
    
    it('should return current state in result when transition fails', () => {
      const result = stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
      
      expect(result.success).toBe(false);
      expect(result.newState).toBe(AppState.IDLE);
    });
  });
});
