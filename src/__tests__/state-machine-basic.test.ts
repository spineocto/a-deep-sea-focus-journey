import { describe, it, expect } from 'vitest';
import { AppState, createStateMachine } from '../state-machine';

describe('State Machine - Basic Functionality', () => {
  it('should initialize to IDLE state by default', () => {
    const sm = createStateMachine();
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from IDLE to FOCUSING on START_FOCUS', () => {
    const sm = createStateMachine();
    const result = sm.transition({ type: 'START_FOCUS', durationMinutes: 25 });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.FOCUSING);
    expect(sm.getState()).toBe(AppState.FOCUSING);
  });

  it('should reject START_FOCUS with invalid duration', () => {
    const sm = createStateMachine();
    const result = sm.transition({ type: 'START_FOCUS', durationMinutes: 0 });
    
    expect(result.success).toBe(false);
    expect(result.newState).toBe(AppState.IDLE);
    expect(result.error).toContain('Invalid duration');
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from FOCUSING to DISTRACTED on DISTRACTION_DETECTED', () => {
    const sm = createStateMachine(AppState.FOCUSING);
    const result = sm.transition({ type: 'DISTRACTION_DETECTED' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.DISTRACTED);
    expect(sm.getState()).toBe(AppState.DISTRACTED);
  });

  it('should transition from DISTRACTED to FOCUSING on DISTRACTION_ANIMATION_COMPLETE', () => {
    const sm = createStateMachine(AppState.DISTRACTED);
    const result = sm.transition({ type: 'DISTRACTION_ANIMATION_COMPLETE' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.FOCUSING);
    expect(sm.getState()).toBe(AppState.FOCUSING);
  });

  it('should transition from FOCUSING to SHORT_BREAK on ROUND_COMPLETE (not ending, not long break)', () => {
    const sm = createStateMachine(AppState.FOCUSING);
    const result = sm.transition({ 
      type: 'ROUND_COMPLETE', 
      shouldShowEnding: false, 
      isLongBreak: false 
    });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.SHORT_BREAK);
    expect(sm.getState()).toBe(AppState.SHORT_BREAK);
  });

  it('should transition from FOCUSING to LONG_BREAK on ROUND_COMPLETE (not ending, is long break)', () => {
    const sm = createStateMachine(AppState.FOCUSING);
    const result = sm.transition({ 
      type: 'ROUND_COMPLETE', 
      shouldShowEnding: false, 
      isLongBreak: true 
    });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.LONG_BREAK);
    expect(sm.getState()).toBe(AppState.LONG_BREAK);
  });

  it('should transition from FOCUSING to ENDING on ROUND_COMPLETE (is ending)', () => {
    const sm = createStateMachine(AppState.FOCUSING);
    const result = sm.transition({ 
      type: 'ROUND_COMPLETE', 
      shouldShowEnding: true, 
      isLongBreak: false 
    });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.ENDING);
    expect(sm.getState()).toBe(AppState.ENDING);
  });

  it('should transition from FOCUSING to IDLE on ABANDON_ROUND', () => {
    const sm = createStateMachine(AppState.FOCUSING);
    const result = sm.transition({ type: 'ABANDON_ROUND' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from DISTRACTED to IDLE on ABANDON_ROUND', () => {
    const sm = createStateMachine(AppState.DISTRACTED);
    const result = sm.transition({ type: 'ABANDON_ROUND' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from SHORT_BREAK to IDLE on BREAK_COMPLETE', () => {
    const sm = createStateMachine(AppState.SHORT_BREAK);
    const result = sm.transition({ type: 'BREAK_COMPLETE' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from SHORT_BREAK to IDLE on SKIP_BREAK', () => {
    const sm = createStateMachine(AppState.SHORT_BREAK);
    const result = sm.transition({ type: 'SKIP_BREAK' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from LONG_BREAK to IDLE on BREAK_COMPLETE', () => {
    const sm = createStateMachine(AppState.LONG_BREAK);
    const result = sm.transition({ type: 'BREAK_COMPLETE' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from LONG_BREAK to IDLE on SKIP_BREAK', () => {
    const sm = createStateMachine(AppState.LONG_BREAK);
    const result = sm.transition({ type: 'SKIP_BREAK' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from ENDING to IDLE on ENDING_CONFIRMED', () => {
    const sm = createStateMachine(AppState.ENDING);
    const result = sm.transition({ type: 'ENDING_CONFIRMED' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should transition from ENDING to IDLE on DIVE_AGAIN', () => {
    const sm = createStateMachine(AppState.ENDING);
    const result = sm.transition({ type: 'DIVE_AGAIN' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should allow IDLE to IDLE transition on DIVE_AGAIN', () => {
    const sm = createStateMachine(AppState.IDLE);
    const result = sm.transition({ type: 'DIVE_AGAIN' });
    
    expect(result.success).toBe(true);
    expect(result.newState).toBe(AppState.IDLE);
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should reject illegal transition from IDLE with DISTRACTION_DETECTED', () => {
    const sm = createStateMachine(AppState.IDLE);
    const result = sm.transition({ type: 'DISTRACTION_DETECTED' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Illegal transition');
    expect(sm.getState()).toBe(AppState.IDLE);
  });

  it('should reject illegal transition from FOCUSING with BREAK_COMPLETE', () => {
    const sm = createStateMachine(AppState.FOCUSING);
    const result = sm.transition({ type: 'BREAK_COMPLETE' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Illegal transition');
    expect(sm.getState()).toBe(AppState.FOCUSING);
  });

  it('should correctly report canTransition', () => {
    const sm = createStateMachine(AppState.IDLE);
    
    expect(sm.canTransition({ type: 'START_FOCUS', durationMinutes: 25 })).toBe(true);
    expect(sm.canTransition({ type: 'DISTRACTION_DETECTED' })).toBe(false);
  });
});
