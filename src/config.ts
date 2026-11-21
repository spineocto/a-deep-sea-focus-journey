/**
 * Config 模組
 * 
 * 集中管理所有可調整參數，確保型別安全並便於調整遊戲參數。
 */

export type Zone = 'Sunlit' | 'Twilight' | 'Midnight' | 'Abyssal' | 'Hadal';

export interface ZoneDefinition {
  readonly name: Zone;
  readonly min: number;
  readonly max: number;
}

export const Config = {
  // 計時參數
  descentSpeedPerMinute: 12, // 公尺/分鐘
  durationOptions: [15, 25, 45] as const, // 分鐘
  
  // 分心參數
  distractionThreshold: 5, // 秒
  distractedDurationSec: 3, // DISTRACTED 狀態持續時間（秒）
  distractionRisePercentage: 20, // %
  maxDistractionRisePercentage: 50, // %
  
  // 休息參數
  shortBreakDuration: 5, // 分鐘
  longBreakDuration: 15, // 分鐘
  longBreakInterval: 4, // 每幾輪長休息
  
  // 深度參數
  targetDepth: 10900, // 公尺
  zones: [
    { name: 'Sunlit' as const, min: 0, max: 200 },
    { name: 'Twilight' as const, min: 200, max: 1000 },
    { name: 'Midnight' as const, min: 1000, max: 4000 },
    { name: 'Abyssal' as const, min: 4000, max: 6000 },
    { name: 'Hadal' as const, min: 6000, max: Infinity }
  ] as const,
  
  // 演示模式
  demoModeMultiplier: 60,
  
  // 自動儲存
  autoSaveInterval: 5, // 秒
  lastSeenUpdateInterval: 5, // 秒
} as const;
