/**
 * Codex Manager 模組
 * 
 * 管理深海生物卡片的解鎖邏輯，包含 6 張真實深海生物卡片。
 * 實作最淺優先選擇邏輯，確保遊戲進度合理且具收集動機。
 */

import { Config, type Zone } from './config.js';

/**
 * 生物卡片介面
 */
export interface CreatureCard {
  readonly id: string;
  readonly zone: Zone;
  readonly scientificName: string;
  readonly commonNameEn: string;
  readonly commonNameZh: string;
  readonly depthRange: string;
  readonly facts: string;
  readonly isEndingCard: boolean; // Supergiant amphipod 特殊標記
}

/**
 * 已解鎖卡片紀錄
 */
export interface UnlockedCard {
  cardId: string;
  unlockedAt: number; // 時間戳 (ms)
  obtainedCount: number; // 獲得次數（包含重複獲得）
}

/**
 * 圖鑑狀態
 */
export interface CodexState {
  unlockedCards: UnlockedCard[];
}

/**
 * 解鎖結果
 */
export interface UnlockResult {
  card: CreatureCard;
  isDuplicate: boolean; // 是否為重複獲得
}

/**
 * 6 張真實深海生物卡片定義
 * 資料來源：docs/codex.md
 */
export const CREATURE_CARDS: readonly CreatureCard[] = [
  {
    id: 'moon-jellyfish',
    zone: 'Sunlit',
    scientificName: 'Aurelia aurita',
    commonNameEn: 'Moon jellyfish',
    commonNameZh: '海月水母',
    depthRange: '0-1,250 m',
    facts: 'Mostly near the surface in coastal waters; recorded 0–1,250 m. Sources: SeaLifeBase; WoRMS',
    isEndingCard: false
  },
  {
    id: 'barreleye',
    zone: 'Twilight',
    scientificName: 'Macropinna microstoma',
    commonNameEn: 'Barreleye',
    commonNameZh: '桶眼魚',
    depthRange: '600-800 m',
    facts: '600–800 m; transparent head, green tubular eyes. Sources: MBARI; Monterey Bay Aquarium',
    isEndingCard: false
  },
  {
    id: 'humpback-anglerfish',
    zone: 'Midnight',
    scientificName: 'Melanocetus johnsonii',
    commonNameEn: 'Humpback anglerfish',
    commonNameZh: '黑魔鬼鮟鱇',
    depthRange: '100-3,600 m',
    facts: 'Usually 100–1,500 m (most often 500–1,500 m); recorded to ~3,600 m. Sources: FishBase; Pietsch via Zenodo',
    isEndingCard: false
  },
  {
    id: 'dumbo-octopus',
    zone: 'Abyssal',
    scientificName: 'Grimpoteuthis spp.',
    commonNameEn: 'Dumbo octopus',
    commonNameZh: '小飛象章魚',
    depthRange: '1,000-7,000 m',
    facts: '1,000–7,000 m; deepest octopus ever filmed at 6,957 m (Java Trench, 2020). Sources: NHM London; Marine Biology 2020; Guinness',
    isEndingCard: false
  },
  {
    id: 'mariana-snailfish',
    zone: 'Hadal',
    scientificName: 'Pseudoliparis swirei',
    commonNameEn: 'Mariana snailfish',
    commonNameZh: '馬里亞納獅子魚',
    depthRange: '6,198-8,178 m',
    facts: '6,198–8,178 m, usually 7,000–8,000 m; no fish likely below ~8,400 m. Sources: FishBase; NOAA Ocean Exploration',
    isEndingCard: false
  },
  {
    id: 'supergiant-amphipod',
    zone: 'Hadal',
    scientificName: 'Hirondellea gigas',
    commonNameEn: 'Supergiant amphipod',
    commonNameZh: '巨型端足類',
    depthRange: '6,800-11,000 m',
    facts: '~6,800–11,000 m; dominant animal of Challenger Deep (collected at 10,929 m). Sources: Cell 2025; Mitochondrial DNA B 2016',
    isEndingCard: true
  }
] as const;

/**
 * Codex Manager 介面
 */
export interface CodexManager {
  /**
   * 根據總深度與圖鑑狀態選擇卡片
   * @param totalDepth 當前總深度 (m)
   * @param codexState 圖鑑狀態
   * @param shouldShowEnding 是否應該顯示終局卡片（達到 10900m）
   * @returns 解鎖結果（卡片與是否重複）
   */
  selectCardForRound(
    totalDepth: number,
    codexState: CodexState,
    shouldShowEnding: boolean
  ): UnlockResult;

  /**
   * 檢查特定卡片是否已解鎖
   * @param cardId 卡片 ID
   * @param codexState 圖鑑狀態
   * @returns 是否已解鎖
   */
  isUnlocked(cardId: string, codexState: CodexState): boolean;

  /**
   * 取得所有已解鎖卡片
   * @param codexState 圖鑑狀態
   * @returns 已解鎖的卡片陣列
   */
  getUnlockedCards(codexState: CodexState): CreatureCard[];

  /**
   * 根據 ID 取得卡片
   * @param cardId 卡片 ID
   * @returns 卡片物件，若不存在則回傳 undefined
   */
  getCard(cardId: string): CreatureCard | undefined;
}

/**
 * CodexManager 實作
 */
class CodexManagerImpl implements CodexManager {
  selectCardForRound(
    totalDepth: number,
    codexState: CodexState,
    shouldShowEnding: boolean
  ): UnlockResult {
    // 特殊情況：進入 ENDING 狀態時解鎖終局卡片
    if (shouldShowEnding) {
      const endingCard = CREATURE_CARDS.find(c => c.isEndingCard);
      if (!endingCard) {
        throw new Error('Ending card not found');
      }
      return this.unlockOrMarkDuplicate(endingCard, codexState);
    }

    // 一般情況：從前 5 張卡片中選擇（排除終局卡）
    const normalCards = CREATURE_CARDS.filter(c => !c.isEndingCard);
    const unlockedIds = new Set(codexState.unlockedCards.map(u => u.cardId));

    // 1. 找出所有尚未解鎖的卡片
    const lockedCards = normalCards.filter(c => !unlockedIds.has(c.id));

    // 2. 找出所有已達深度的卡片（深度 >= zone 最小值）
    const reachableLockedCards = lockedCards.filter(c => {
      const cardZone = Config.zones.find(z => z.name === c.zone);
      return cardZone ? totalDepth >= cardZone.min : false;
    });

    // 3. 如果有可達的未解鎖卡片，選擇最淺的
    if (reachableLockedCards.length > 0) {
      const shallowestCard = this.findShallowestCard(reachableLockedCards);
      return this.unlockOrMarkDuplicate(shallowestCard, codexState);
    }

    // 4. 所有已達 Zone 的卡片都已解鎖 → 記錄重複獲得
    // 從已解鎖的卡片中選擇已達深度的最淺卡片
    const unlockedReachableCards = normalCards.filter(c => {
      const cardZone = Config.zones.find(z => z.name === c.zone);
      return cardZone ? totalDepth >= cardZone.min && unlockedIds.has(c.id) : false;
    });

    if (unlockedReachableCards.length > 0) {
      const shallowestUnlocked = this.findShallowestCard(unlockedReachableCards);
      return this.unlockOrMarkDuplicate(shallowestUnlocked, codexState);
    }

    // 理論上不會到這裡（第一輪一定可以拿到 Moon jellyfish）
    throw new Error('No card available for current depth');
  }

  isUnlocked(cardId: string, codexState: CodexState): boolean {
    return codexState.unlockedCards.some(u => u.cardId === cardId);
  }

  getUnlockedCards(codexState: CodexState): CreatureCard[] {
    return codexState.unlockedCards
      .map(u => this.getCard(u.cardId))
      .filter((card): card is CreatureCard => card !== undefined);
  }

  getCard(cardId: string): CreatureCard | undefined {
    return CREATURE_CARDS.find(c => c.id === cardId);
  }

  /**
   * 找出陣列中最淺的卡片（zone 最小值最小）
   */
  private findShallowestCard(cards: CreatureCard[]): CreatureCard {
    return cards.reduce((prev, curr) => {
      const prevZone = Config.zones.find(z => z.name === prev.zone);
      const currZone = Config.zones.find(z => z.name === curr.zone);
      
      if (!prevZone || !currZone) {
        return prev;
      }
      
      return prevZone.min < currZone.min ? prev : curr;
    });
  }

  /**
   * 解鎖新卡片或標記重複獲得
   */
  private unlockOrMarkDuplicate(
    card: CreatureCard,
    codexState: CodexState
  ): UnlockResult {
    const existingCard = codexState.unlockedCards.find(u => u.cardId === card.id);

    if (existingCard) {
      // 重複獲得：增加計數
      existingCard.obtainedCount += 1;
      return { card, isDuplicate: true };
    } else {
      // 新解鎖：加入清單
      codexState.unlockedCards.push({
        cardId: card.id,
        unlockedAt: Date.now(),
        obtainedCount: 1
      });
      return { card, isDuplicate: false };
    }
  }
}

// 匯出單例
export const codexManager: CodexManager = new CodexManagerImpl();
