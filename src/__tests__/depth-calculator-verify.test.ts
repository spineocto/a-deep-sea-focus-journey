/**
 * Quick verification tests for Depth Calculator
 * Ensures basic functionality works as expected
 */

import { describe, it, expect } from 'vitest';
import { createDepthCalculator, createInitialDepthState } from '../depth-calculator';

describe('Depth Calculator - Basic Verification', () => {
  const calculator = createDepthCalculator();
  
  it('calculateDescent: 專注 1 分鐘應下沉 12m', () => {
    const oneMinute = 60 * 1000; // 1 minute in ms
    const depth = calculator.calculateDescent(oneMinute);
    expect(depth).toBe(12);
  });
  
  it('calculateDescent: 專注 25 分鐘應下沉 300m', () => {
    const twentyFiveMinutes = 25 * 60 * 1000;
    const depth = calculator.calculateDescent(twentyFiveMinutes);
    expect(depth).toBe(300);
  });
  
  it('calculateRisePenalty: 下沉 100m 的 20% 是 20m', () => {
    const penalty = calculator.calculateRisePenalty(100);
    expect(penalty).toBe(20);
  });
  
  it('applyRisePenalty: 應限制在原始下沉的 50%', () => {
    let state = createInitialDepthState();
    state.roundDescentDepth = 100; // 下沉 100m
    
    // 第一次分心: 20m 上浮
    state = calculator.applyRisePenalty(state, 20);
    expect(state.roundRisePenalty).toBe(20);
    
    // 第二次分心: 再 20m，總共 40m
    state = calculator.applyRisePenalty(state, 20);
    expect(state.roundRisePenalty).toBe(40);
    
    // 第三次分心: 再 20m，但應該被限制在 50m (100m × 50%)
    state = calculator.applyRisePenalty(state, 20);
    expect(state.roundRisePenalty).toBe(50);
    
    // 第四次分心: 應該還是 50m（已達上限）
    state = calculator.applyRisePenalty(state, 20);
    expect(state.roundRisePenalty).toBe(50);
  });
  
  it('getCurrentTotalDepth: 應正確計算本輪淨下沉', () => {
    const state = {
      totalDepth: 100,
      roundStartDepth: 100,
      roundDescentDepth: 50, // 本輪下沉 50m
      roundRisePenalty: 10    // 上浮 10m
    };
    
    // 當前總深度 = 100 + (50 - 10) = 140m
    const currentTotal = calculator.getCurrentTotalDepth(state);
    expect(currentTotal).toBe(140);
  });
  
  it('getCurrentTotalDepth: 上浮大於下沉時不應低於本輪開始深度', () => {
    const state = {
      totalDepth: 100,
      roundStartDepth: 100,
      roundDescentDepth: 30,  // 本輪下沉 30m
      roundRisePenalty: 50     // 上浮 50m (大於下沉)
    };
    
    // 淨下沉 = max(0, 30 - 50) = 0
    // 當前總深度 = 100 + 0 = 100m (不低於本輪開始)
    const currentTotal = calculator.getCurrentTotalDepth(state);
    expect(currentTotal).toBe(100);
  });
  
  it('commitRound: 應將本輪淨下沉加入總深度並重置本輪數據', () => {
    const state = {
      totalDepth: 100,
      roundStartDepth: 100,
      roundDescentDepth: 50,
      roundRisePenalty: 10
    };
    
    const newState = calculator.commitRound(state);
    
    expect(newState.totalDepth).toBe(140); // 100 + (50 - 10)
    expect(newState.roundStartDepth).toBe(140);
    expect(newState.roundDescentDepth).toBe(0);
    expect(newState.roundRisePenalty).toBe(0);
  });
  
  it('abandonRound: 應保留已獲得深度（與 commitRound 相同）', () => {
    const state = {
      totalDepth: 100,
      roundStartDepth: 100,
      roundDescentDepth: 50,
      roundRisePenalty: 10
    };
    
    const newState = calculator.abandonRound(state);
    
    expect(newState.totalDepth).toBe(140);
    expect(newState.roundStartDepth).toBe(140);
    expect(newState.roundDescentDepth).toBe(0);
    expect(newState.roundRisePenalty).toBe(0);
  });
  
  it('getCurrentTotalDepth: 應限制在 10900m', () => {
    const state = {
      totalDepth: 10800,
      roundStartDepth: 10800,
      roundDescentDepth: 200, // 本輪下沉 200m，會超過
      roundRisePenalty: 0
    };
    
    const currentTotal = calculator.getCurrentTotalDepth(state);
    expect(currentTotal).toBe(10900); // 限制在目標深度
  });
  
  it('getZone: 應正確判斷各個深度區間', () => {
    expect(calculator.getZone(0)).toBe('Sunlit');
    expect(calculator.getZone(100)).toBe('Sunlit');
    expect(calculator.getZone(200)).toBe('Twilight');
    expect(calculator.getZone(500)).toBe('Twilight');
    expect(calculator.getZone(1000)).toBe('Midnight');
    expect(calculator.getZone(2000)).toBe('Midnight');
    expect(calculator.getZone(4000)).toBe('Abyssal');
    expect(calculator.getZone(5000)).toBe('Abyssal');
    expect(calculator.getZone(6000)).toBe('Hadal');
    expect(calculator.getZone(10900)).toBe('Hadal');
  });
  
  it('hasReachedTarget: 應正確判斷是否達到目標深度', () => {
    expect(calculator.hasReachedTarget(10899)).toBe(false);
    expect(calculator.hasReachedTarget(10900)).toBe(true);
    expect(calculator.hasReachedTarget(10901)).toBe(true);
  });
  
  it('resetDepth: 應將所有深度重置為 0', () => {
    const state = {
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
  
  it('updateRoundDescent: 應更新本輪下沉深度', () => {
    const state = createInitialDepthState();
    const fifteenMinutes = 15 * 60 * 1000;
    
    const newState = calculator.updateRoundDescent(state, fifteenMinutes);
    
    expect(newState.roundDescentDepth).toBe(180); // 15 × 12
    expect(newState.totalDepth).toBe(0); // 其他不變
    expect(newState.roundStartDepth).toBe(0);
    expect(newState.roundRisePenalty).toBe(0);
  });
});
