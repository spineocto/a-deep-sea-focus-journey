/**
 * Timer 模組基本功能測試
 * 
 * 快速驗證 Timer 模組的核心功能是否正常運作
 */

import { describe, it, expect } from 'vitest';
import { timer } from '../timer';

describe('Timer Module - Basic Functionality', () => {
  it('should initialize timer state correctly', () => {
    const state = timer.start(25, false);
    
    expect(state.selectedDurationMs).toBe(25 * 60 * 1000);
    expect(state.isDemoMode).toBe(false);
    expect(state.hiddenAt).toBe(null);
    expect(state.distractionPenaltyMs).toBe(0);
    expect(state.roundStartAt).toBeGreaterThan(0);
    expect(state.lastSeenAt).toBe(state.roundStartAt);
  });

  it('should calculate elapsed focused time correctly', () => {
    const nowMs = Date.now();
    const state = timer.start(25, false);
    state.roundStartAt = nowMs - 5 * 60 * 1000; // 5 分鐘前開始
    
    const elapsed = timer.getElapsedFocusedTime(state, nowMs);
    
    expect(elapsed).toBe(5 * 60 * 1000); // 5 分鐘
  });

  it('should calculate remaining time correctly', () => {
    const nowMs = Date.now();
    const state = timer.start(25, false);
    state.roundStartAt = nowMs - 5 * 60 * 1000; // 5 分鐘前開始
    
    const remaining = timer.getRemainingTime(state, nowMs);
    
    expect(remaining).toBe(20 * 60 * 1000); // 剩餘 20 分鐘
  });

  it('should apply demo mode multiplier correctly', () => {
    const nowMs = Date.now();
    const state = timer.start(25, true); // Demo mode
    state.roundStartAt = nowMs - 1000; // 1 秒前開始
    
    const elapsed = timer.getElapsedFocusedTime(state, nowMs);
    
    expect(elapsed).toBe(1000 * 60); // 1 秒 × 60 = 60 秒
  });

  it('should mark hidden correctly', () => {
    const state = timer.start(25, false);
    const nowMs = Date.now();
    
    const newState = timer.markHidden(state, nowMs);
    
    expect(newState.hiddenAt).toBe(nowMs);
  });

  it('should mark visible and calculate hidden duration', () => {
    const state = timer.start(25, false);
    const hiddenAt = Date.now();
    state.hiddenAt = hiddenAt;
    const nowMs = hiddenAt + 10 * 1000; // 10 秒後
    
    const { state: newState, hiddenDuration } = timer.markVisible(state, nowMs);
    
    expect(newState.hiddenAt).toBe(null);
    expect(hiddenDuration).toBe(10 * 1000); // 10 秒
  });

  it('should exclude hidden time from elapsed focused time', () => {
    const nowMs = Date.now();
    const state = timer.start(25, false);
    state.roundStartAt = nowMs - 10 * 60 * 1000; // 10 分鐘前開始
    state.hiddenAt = nowMs - 5 * 60 * 1000; // 5 分鐘前隱藏
    
    const elapsed = timer.getElapsedFocusedTime(state, nowMs);
    
    expect(elapsed).toBe(5 * 60 * 1000); // 只有前 5 分鐘計入
  });

  it('should apply distraction penalty', () => {
    const state = timer.start(25, false);
    const penaltyMs = 10 * 1000; // 10 秒懲罰
    
    const newState = timer.applyDistractionPenalty(state, penaltyMs);
    
    expect(newState.distractionPenaltyMs).toBe(penaltyMs);
  });

  it('should subtract distraction penalty from elapsed time', () => {
    const nowMs = Date.now();
    const state = timer.start(25, false);
    state.roundStartAt = nowMs - 10 * 60 * 1000; // 10 分鐘前開始
    state.distractionPenaltyMs = 2 * 60 * 1000; // 2 分鐘懲罰
    
    const elapsed = timer.getElapsedFocusedTime(state, nowMs);
    
    expect(elapsed).toBe(8 * 60 * 1000); // 10 - 2 = 8 分鐘
  });

  it('should update lastSeenAt', () => {
    const state = timer.start(25, false);
    const nowMs = Date.now();
    
    const newState = timer.updateLastSeen(state, nowMs);
    
    expect(newState.lastSeenAt).toBe(nowMs);
  });

  it('should check completion correctly', () => {
    const nowMs = Date.now();
    const state = timer.start(25, false);
    state.roundStartAt = nowMs - 25 * 60 * 1000; // 25 分鐘前開始
    
    const isComplete = timer.isComplete(state, nowMs);
    
    expect(isComplete).toBe(true);
  });

  it('should never return negative elapsed time', () => {
    const nowMs = Date.now();
    const state = timer.start(25, false);
    state.roundStartAt = nowMs + 5 * 60 * 1000; // 未來的時間（不應該發生）
    
    const elapsed = timer.getElapsedFocusedTime(state, nowMs);
    
    expect(elapsed).toBe(0); // 應該回傳 0 而非負數
  });

  it('should never return negative remaining time', () => {
    const nowMs = Date.now();
    const state = timer.start(25, false);
    state.roundStartAt = nowMs - 30 * 60 * 1000; // 30 分鐘前開始（超過選定時長）
    
    const remaining = timer.getRemainingTime(state, nowMs);
    
    expect(remaining).toBe(0); // 應該回傳 0 而非負數
  });

  it('should handle demo mode in markVisible', () => {
    const state = timer.start(25, true); // Demo mode
    const hiddenAt = Date.now();
    state.hiddenAt = hiddenAt;
    const nowMs = hiddenAt + 1000; // 1 秒後
    
    const { hiddenDuration } = timer.markVisible(state, nowMs);
    
    expect(hiddenDuration).toBe(1000 * 60); // 1 秒 × 60 = 60 秒
  });

  it('should handle markVisible when hiddenAt is null', () => {
    const state = timer.start(25, false);
    state.hiddenAt = null;
    const nowMs = Date.now();
    
    const { state: newState, hiddenDuration } = timer.markVisible(state, nowMs);
    
    expect(newState.hiddenAt).toBe(null);
    expect(hiddenDuration).toBe(0);
  });
});
