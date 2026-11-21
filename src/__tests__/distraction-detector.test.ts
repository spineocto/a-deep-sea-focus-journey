/**
 * Distraction Detector 模組單元測試
 * 
 * 測試分心偵測邏輯與上浮懲罰計算
 */

import { describe, it, expect } from 'vitest';
import { distractionDetector } from '../distraction-detector.js';
import { Config } from '../config.js';

describe('DistractionDetector', () => {
  describe('checkDistraction', () => {
    describe('5 秒閾值判斷', () => {
      it('應該在隱藏時長為 4999ms 時不觸發分心', () => {
        const result = distractionDetector.checkDistraction(4999);
        
        expect(result.triggered).toBe(false);
        expect(result.shouldExcludeTime).toBe(false);
        expect(result.hiddenDuration).toBe(4999);
      });
      
      it('應該在隱藏時長為 5000ms 時不觸發分心（等於閾值）', () => {
        const result = distractionDetector.checkDistraction(5000);
        
        expect(result.triggered).toBe(false);
        expect(result.shouldExcludeTime).toBe(false);
        expect(result.hiddenDuration).toBe(5000);
      });
      
      it('應該在隱藏時長為 5001ms 時觸發分心', () => {
        const result = distractionDetector.checkDistraction(5001);
        
        expect(result.triggered).toBe(true);
        expect(result.shouldExcludeTime).toBe(true);
        expect(result.hiddenDuration).toBe(5001);
      });
      
      it('應該在隱藏時長為 10000ms 時觸發分心', () => {
        const result = distractionDetector.checkDistraction(10000);
        
        expect(result.triggered).toBe(true);
        expect(result.shouldExcludeTime).toBe(true);
        expect(result.hiddenDuration).toBe(10000);
      });
    });
    
    describe('邊界值測試', () => {
      it('應該在隱藏時長為 0ms 時不觸發分心', () => {
        const result = distractionDetector.checkDistraction(0);
        
        expect(result.triggered).toBe(false);
        expect(result.shouldExcludeTime).toBe(false);
        expect(result.hiddenDuration).toBe(0);
      });
      
      it('應該在隱藏時長為 1ms 時不觸發分心', () => {
        const result = distractionDetector.checkDistraction(1);
        
        expect(result.triggered).toBe(false);
        expect(result.shouldExcludeTime).toBe(false);
        expect(result.hiddenDuration).toBe(1);
      });
      
      it('應該在隱藏時長極大時仍能觸發分心', () => {
        const result = distractionDetector.checkDistraction(999999999);
        
        expect(result.triggered).toBe(true);
        expect(result.shouldExcludeTime).toBe(true);
        expect(result.hiddenDuration).toBe(999999999);
      });
    });
    
    describe('與 Config 閾值一致性', () => {
      it('應該使用 Config.distractionThreshold 作為判斷標準', () => {
        const thresholdMs = Config.distractionThreshold * 1000;
        
        // 剛好在閾值
        const atThreshold = distractionDetector.checkDistraction(thresholdMs);
        expect(atThreshold.triggered).toBe(false);
        
        // 超過閾值 1ms
        const overThreshold = distractionDetector.checkDistraction(thresholdMs + 1);
        expect(overThreshold.triggered).toBe(true);
      });
    });
  });
  
  describe('calculateRisePenalty', () => {
    describe('20% 懲罰計算', () => {
      it('應該計算當前深度的 20% 作為上浮懲罰', () => {
        const penalty = distractionDetector.calculateRisePenalty(100);
        expect(penalty).toBe(20);
      });
      
      it('應該正確計算小數深度的 20%', () => {
        const penalty = distractionDetector.calculateRisePenalty(123.45);
        expect(penalty).toBeCloseTo(24.69, 2);
      });
      
      it('應該在深度為 0 時回傳 0', () => {
        const penalty = distractionDetector.calculateRisePenalty(0);
        expect(penalty).toBe(0);
      });
      
      it('應該正確計算大數值深度', () => {
        const penalty = distractionDetector.calculateRisePenalty(10000);
        expect(penalty).toBe(2000);
      });
    });
    
    describe('與 Config 百分比一致性', () => {
      it('應該使用 Config.distractionRisePercentage 計算懲罰', () => {
        const depth = 500;
        const expectedPenalty = depth * (Config.distractionRisePercentage / 100);
        
        const penalty = distractionDetector.calculateRisePenalty(depth);
        expect(penalty).toBe(expectedPenalty);
      });
    });
    
    describe('各種深度的懲罰計算', () => {
      it('應該計算 60m 深度的懲罰（5 分鐘專注）', () => {
        // 5 分鐘 × 12 m/min = 60m
        const penalty = distractionDetector.calculateRisePenalty(60);
        expect(penalty).toBe(12);
      });
      
      it('應該計算 180m 深度的懲罰（15 分鐘專注）', () => {
        // 15 分鐘 × 12 m/min = 180m
        const penalty = distractionDetector.calculateRisePenalty(180);
        expect(penalty).toBe(36);
      });
      
      it('應該計算 300m 深度的懲罰（25 分鐘專注）', () => {
        // 25 分鐘 × 12 m/min = 300m
        const penalty = distractionDetector.calculateRisePenalty(300);
        expect(penalty).toBe(60);
      });
      
      it('應該計算 540m 深度的懲罰（45 分鐘專注）', () => {
        // 45 分鐘 × 12 m/min = 540m
        const penalty = distractionDetector.calculateRisePenalty(540);
        expect(penalty).toBe(108);
      });
    });
  });
  
  describe('shouldExcludeTime 旗標邏輯', () => {
    it('當不觸發分心時，shouldExcludeTime 應為 false', () => {
      const result = distractionDetector.checkDistraction(3000);
      expect(result.triggered).toBe(false);
      expect(result.shouldExcludeTime).toBe(false);
    });
    
    it('當觸發分心時，shouldExcludeTime 應為 true', () => {
      const result = distractionDetector.checkDistraction(6000);
      expect(result.triggered).toBe(true);
      expect(result.shouldExcludeTime).toBe(true);
    });
    
    it('shouldExcludeTime 應該與 triggered 始終一致', () => {
      const testCases = [0, 1000, 5000, 5001, 10000, 60000];
      
      testCases.forEach(duration => {
        const result = distractionDetector.checkDistraction(duration);
        expect(result.shouldExcludeTime).toBe(result.triggered);
      });
    });
  });
});
