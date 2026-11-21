/**
 * Demo Mode Module
 * 
 * Provides time acceleration and storage isolation for demo/presentation purposes.
 * Demo mode runs at 60x speed and uses separate localStorage keys.
 */

import { AppState } from './state-machine.js';
import { Config } from './config.js';

export interface DemoMode {
  isEnabled: boolean;
  
  // 切換
  toggle(): boolean; // 回傳新狀態
  canToggle(currentState: AppState): boolean;
  
  // 查詢
  getTimeMultiplier(): number;
  getStorageKey(): string;
}

class DemoModeImpl implements DemoMode {
  private enabled = false;
  
  get isEnabled(): boolean {
    return this.enabled;
  }
  
  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
  
  canToggle(currentState: AppState): boolean {
    return currentState === AppState.IDLE;
  }
  
  getTimeMultiplier(): number {
    return this.enabled ? Config.demoModeMultiplier : 1;
  }
  
  getStorageKey(): string {
    return this.enabled ? 'demo_' : '';
  }
}

// Singleton instance
export const demoMode: DemoMode = new DemoModeImpl();
