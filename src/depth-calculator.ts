/**
 * Depth Calculator Module
 * 
 * Calculates depth based on focused time, manages depth state including
 * descent, rise penalties from distractions, and zone determination.
 * 
 * Core formulas:
 * - Descent depth = focused time (minutes) × 12 m/min
 * - Single rise penalty = current descent × 20%
 * - Max rise penalty = round descent × 50%
 * - Net descent = max(0, round descent - round rise penalty)
 * - Current total = min(round start + net descent, 10900)
 */

import { Config, type Zone } from './config';

export interface DepthState {
  totalDepth: number;          // 累積總深度 (m)
  roundStartDepth: number;     // 本輪開始時的深度 (m)
  roundDescentDepth: number;   // 本輪下沉深度 (m)
  roundRisePenalty: number;    // 本輪累積上浮懲罰 (m)
}

export interface DepthCalculator {
  // 計算深度
  calculateDescent(focusedTimeMs: number): number;
  
  // 更新深度狀態
  updateRoundDescent(state: DepthState, focusedTimeMs: number): DepthState;
  
  // 上浮懲罰
  calculateRisePenalty(currentDescent: number): number;
  applyRisePenalty(state: DepthState, risePenalty: number): DepthState;
  
  // 完成一輪
  commitRound(state: DepthState): DepthState;
  
  // 放棄一輪
  abandonRound(state: DepthState): DepthState;
  
  // 重新下潛
  resetDepth(state: DepthState): DepthState;
  
  // Zone 查詢
  getZone(totalDepth: number): Zone;
  hasReachedTarget(totalDepth: number): boolean;
  
  // 獲取當前總深度（考慮本輪淨下沉）
  getCurrentTotalDepth(state: DepthState): number;
}

export class DepthCalculatorImpl implements DepthCalculator {
  calculateDescent(focusedTimeMs: number): number {
    // 下沉深度 = 專注時間（分鐘）× 下沉速度（公尺/分鐘）
    const focusedMinutes = focusedTimeMs / 1000 / 60;
    return focusedMinutes * Config.descentSpeedPerMinute;
  }
  
  updateRoundDescent(state: DepthState, focusedTimeMs: number): DepthState {
    const newDescent = this.calculateDescent(focusedTimeMs);
    return {
      ...state,
      roundDescentDepth: newDescent
    };
  }
  
  calculateRisePenalty(currentDescent: number): number {
    // 單次上浮懲罰 = 當下本輪已下沉深度 × 20%
    return currentDescent * (Config.distractionRisePercentage / 100);
  }
  
  applyRisePenalty(state: DepthState, risePenalty: number): DepthState {
    // 計算新的累積上浮懲罰
    const newRisePenalty = state.roundRisePenalty + risePenalty;
    
    // 本輪累積上浮 ≤ 本輪原始下沉深度 × 50%
    const maxRise = state.roundDescentDepth * (Config.maxDistractionRisePercentage / 100);
    const cappedRisePenalty = Math.min(newRisePenalty, maxRise);
    
    return {
      ...state,
      roundRisePenalty: cappedRisePenalty
    };
  }
  
  getCurrentTotalDepth(state: DepthState): number {
    // 本輪淨下沉 = 本輪下沉深度 - 本輪上浮懲罰
    const netDescent = Math.max(0, state.roundDescentDepth - state.roundRisePenalty);
    
    // 當前總深度 = 本輪開始深度 + 本輪淨下沉
    const total = state.roundStartDepth + netDescent;
    
    // 確保不超過目標深度
    return Math.min(total, Config.targetDepth);
  }
  
  commitRound(state: DepthState): DepthState {
    // 完成一輪：將本輪淨下沉加入總深度
    const newTotal = this.getCurrentTotalDepth(state);
    
    return {
      totalDepth: newTotal,
      roundStartDepth: newTotal,
      roundDescentDepth: 0,
      roundRisePenalty: 0
    };
  }
  
  abandonRound(state: DepthState): DepthState {
    // 放棄一輪：保留已獲得的深度
    const newTotal = this.getCurrentTotalDepth(state);
    
    return {
      totalDepth: newTotal,
      roundStartDepth: newTotal,
      roundDescentDepth: 0,
      roundRisePenalty: 0
    };
  }
  
  resetDepth(_state: DepthState): DepthState {
    // 重新下潛：總深度歸零
    return {
      totalDepth: 0,
      roundStartDepth: 0,
      roundDescentDepth: 0,
      roundRisePenalty: 0
    };
  }
  
  getZone(totalDepth: number): Zone {
    // 根據深度判斷 Zone
    for (const zone of Config.zones) {
      if (totalDepth >= zone.min && totalDepth < zone.max) {
        return zone.name;
      }
    }
    
    // Fallback（理論上不會到這裡，因為最後一個 zone 的 max 是 Infinity）
    return 'Hadal';
  }
  
  hasReachedTarget(totalDepth: number): boolean {
    return totalDepth >= Config.targetDepth;
  }
}

// Factory function for creating depth calculators
export function createDepthCalculator(): DepthCalculator {
  return new DepthCalculatorImpl();
}

// Helper function to create initial depth state
export function createInitialDepthState(): DepthState {
  return {
    totalDepth: 0,
    roundStartDepth: 0,
    roundDescentDepth: 0,
    roundRisePenalty: 0
  };
}
