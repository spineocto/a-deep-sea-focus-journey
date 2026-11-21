/**
 * Distraction Detector 模組
 * 
 * 偵測分心事件與計算懲罰。
 * 
 * 核心邏輯：
 * - 隱藏時長 > 5 秒：觸發分心，排除整段時間
 * - 隱藏時長 <= 5 秒：不觸發分心，時間計入專注
 * - 上浮懲罰 = 當前下沉深度 × 20%
 */

import { Config } from './config.js';

/**
 * 分心事件結果
 */
export interface DistractionEvent {
  triggered: boolean;           // 是否觸發分心事件
  hiddenDuration: number;        // 隱藏時長 (ms)
  shouldExcludeTime: boolean;    // 是否排除此段時間
}

/**
 * Distraction Detector 介面
 */
export interface DistractionDetector {
  /**
   * 判斷是否觸發分心事件
   * 
   * @param hiddenDurationMs - 分頁隱藏時長（毫秒）
   * @returns 分心事件結果
   */
  checkDistraction(hiddenDurationMs: number): DistractionEvent;
  
  /**
   * 計算上浮懲罰
   * 
   * @param currentDescentDepth - 當前本輪下沉深度（公尺）
   * @returns 上浮深度（公尺）
   */
  calculateRisePenalty(currentDescentDepth: number): number;
}

/**
 * Distraction Detector 實作
 */
class DistractionDetectorImpl implements DistractionDetector {
  /**
   * 判斷是否觸發分心事件
   * 
   * 規則：
   * - 隱藏時長 > 5 秒（distractionThreshold）：觸發分心，排除整段時間
   * - 隱藏時長 <= 5 秒：不觸發分心，時間計入專注
   */
  checkDistraction(hiddenDurationMs: number): DistractionEvent {
    const thresholdMs = Config.distractionThreshold * 1000;
    
    if (hiddenDurationMs > thresholdMs) {
      // 隱藏超過 5 秒：觸發分心，排除整段時間
      return {
        triggered: true,
        hiddenDuration: hiddenDurationMs,
        shouldExcludeTime: true
      };
    } else {
      // 隱藏未超過 5 秒：不觸發分心，時間計入專注
      return {
        triggered: false,
        hiddenDuration: hiddenDurationMs,
        shouldExcludeTime: false
      };
    }
  }
  
  /**
   * 計算上浮懲罰
   * 
   * 公式：上浮深度 = 當前下沉深度 × 20%
   * 
   * 注意：此方法只計算單次懲罰，累積上限（50%）由 Depth Calculator 處理
   */
  calculateRisePenalty(currentDescentDepth: number): number {
    return currentDescentDepth * (Config.distractionRisePercentage / 100);
  }
}

/**
 * 匯出單例實例
 */
export const distractionDetector: DistractionDetector = new DistractionDetectorImpl();
