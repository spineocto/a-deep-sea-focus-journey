/**
 * Codex Manager 模組單元測試
 */

import { describe, it, expect } from 'vitest';
import { 
  codexManager, 
  CREATURE_CARDS,
  type CodexState
} from '../codex-manager';

describe('Codex Manager', () => {
  describe('CREATURE_CARDS', () => {
    it('should have exactly 6 cards', () => {
      expect(CREATURE_CARDS).toHaveLength(6);
    });

    it('should have 5 normal cards and 1 ending card', () => {
      const normalCards = CREATURE_CARDS.filter(c => !c.isEndingCard);
      const endingCards = CREATURE_CARDS.filter(c => c.isEndingCard);
      
      expect(normalCards).toHaveLength(5);
      expect(endingCards).toHaveLength(1);
    });

    it('should have ending card as Supergiant amphipod', () => {
      const endingCard = CREATURE_CARDS.find(c => c.isEndingCard);
      
      expect(endingCard).toBeDefined();
      if (!endingCard) return;
      
      expect(endingCard.id).toBe('supergiant-amphipod');
      expect(endingCard.commonNameEn).toBe('Supergiant amphipod');
    });

    it('should have cards in zone order from shallow to deep', () => {
      const normalCards = CREATURE_CARDS.filter(c => !c.isEndingCard);
      
      expect(normalCards[0].zone).toBe('Sunlit');
      expect(normalCards[1].zone).toBe('Twilight');
      expect(normalCards[2].zone).toBe('Midnight');
      expect(normalCards[3].zone).toBe('Abyssal');
      expect(normalCards[4].zone).toBe('Hadal');
    });

    it('should have all required fields for each card', () => {
      CREATURE_CARDS.forEach(card => {
        expect(card.id).toBeTruthy();
        expect(card.zone).toBeTruthy();
        expect(card.scientificName).toBeTruthy();
        expect(card.commonNameEn).toBeTruthy();
        expect(card.commonNameZh).toBeTruthy();
        expect(card.depthRange).toBeTruthy();
        expect(card.facts).toBeTruthy();
        expect(typeof card.isEndingCard).toBe('boolean');
      });
    });
  });

  describe('getCard', () => {
    it('should return card by id', () => {
      const card = codexManager.getCard('moon-jellyfish');
      
      expect(card).toBeDefined();
      if (!card) return;
      
      expect(card.commonNameEn).toBe('Moon jellyfish');
      expect(card.zone).toBe('Sunlit');
    });

    it('should return undefined for non-existent id', () => {
      const card = codexManager.getCard('non-existent');
      
      expect(card).toBeUndefined();
    });

    it('should return all 6 cards by their ids', () => {
      const ids = [
        'moon-jellyfish',
        'barreleye',
        'humpback-anglerfish',
        'dumbo-octopus',
        'mariana-snailfish',
        'supergiant-amphipod'
      ];

      ids.forEach(id => {
        const card = codexManager.getCard(id);
        expect(card).toBeDefined();
        if (!card) return;
        expect(card.id).toBe(id);
      });
    });
  });

  describe('isUnlocked', () => {
    it('should return false for empty codex state', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      expect(codexManager.isUnlocked('moon-jellyfish', codexState)).toBe(false);
    });

    it('should return true for unlocked card', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      expect(codexManager.isUnlocked('moon-jellyfish', codexState)).toBe(true);
    });

    it('should return false for non-unlocked card', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      expect(codexManager.isUnlocked('barreleye', codexState)).toBe(false);
    });
  });

  describe('getUnlockedCards', () => {
    it('should return empty array for empty codex state', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      const cards = codexManager.getUnlockedCards(codexState);
      
      expect(cards).toHaveLength(0);
    });

    it('should return unlocked cards', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'barreleye', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      const cards = codexManager.getUnlockedCards(codexState);
      
      expect(cards).toHaveLength(2);
      expect(cards[0].id).toBe('moon-jellyfish');
      expect(cards[1].id).toBe('barreleye');
    });

    it('should filter out invalid card ids', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'invalid-card', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      const cards = codexManager.getUnlockedCards(codexState);
      
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('moon-jellyfish');
    });
  });

  describe('selectCardForRound - ending card', () => {
    it('should return Supergiant amphipod when shouldShowEnding is true', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      const result = codexManager.selectCardForRound(10900, codexState, true);
      
      expect(result.card.id).toBe('supergiant-amphipod');
      expect(result.isDuplicate).toBe(false);
    });

    it('should mark Supergiant amphipod as duplicate if already unlocked', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'supergiant-amphipod', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      const result = codexManager.selectCardForRound(10900, codexState, true);
      
      expect(result.card.id).toBe('supergiant-amphipod');
      expect(result.isDuplicate).toBe(true);
      expect(codexState.unlockedCards[0].obtainedCount).toBe(2);
    });
  });

  describe('selectCardForRound - normal cards', () => {
    it('should return Moon jellyfish for first round at depth 0', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      const result = codexManager.selectCardForRound(0, codexState, false);
      
      expect(result.card.id).toBe('moon-jellyfish');
      expect(result.isDuplicate).toBe(false);
      expect(codexState.unlockedCards).toHaveLength(1);
      expect(codexState.unlockedCards[0].cardId).toBe('moon-jellyfish');
      expect(codexState.unlockedCards[0].obtainedCount).toBe(1);
    });

    it('should return Barreleye at depth 250m when Moon jellyfish is already unlocked', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      const result = codexManager.selectCardForRound(250, codexState, false);
      
      expect(result.card.id).toBe('barreleye');
      expect(result.isDuplicate).toBe(false);
    });

    it('should select shallowest unlocked card at depth 250m when Moon jellyfish is unlocked', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      const result = codexManager.selectCardForRound(250, codexState, false);
      
      // At 250m, we can reach Sunlit (0-200) and Twilight (200-1000)
      // Moon jellyfish is unlocked, so we should get Barreleye (Twilight)
      expect(result.card.zone).toBe('Twilight');
    });

    it('should not select cards from unreached zones', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      // At 150m, only Sunlit zone is reachable (0-200)
      const result = codexManager.selectCardForRound(150, codexState, false);
      
      expect(result.card.zone).toBe('Sunlit');
    });

    it('should select shallowest unlocked card progressively', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      // Round 1: depth 180m -> Moon jellyfish (Sunlit)
      let result = codexManager.selectCardForRound(180, codexState, false);
      expect(result.card.id).toBe('moon-jellyfish');
      
      // Round 2: depth 500m -> Barreleye (Twilight)
      result = codexManager.selectCardForRound(500, codexState, false);
      expect(result.card.id).toBe('barreleye');
      
      // Round 3: depth 2000m -> Humpback anglerfish (Midnight)
      result = codexManager.selectCardForRound(2000, codexState, false);
      expect(result.card.id).toBe('humpback-anglerfish');
      
      // Round 4: depth 5000m -> Dumbo octopus (Abyssal)
      result = codexManager.selectCardForRound(5000, codexState, false);
      expect(result.card.id).toBe('dumbo-octopus');
      
      // Round 5: depth 7000m -> Mariana snailfish (Hadal)
      result = codexManager.selectCardForRound(7000, codexState, false);
      expect(result.card.id).toBe('mariana-snailfish');
    });

    it('should mark duplicate when all reachable cards are unlocked', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      // At 150m, only Moon jellyfish is reachable and it's already unlocked
      const result = codexManager.selectCardForRound(150, codexState, false);
      
      expect(result.card.id).toBe('moon-jellyfish');
      expect(result.isDuplicate).toBe(true);
      expect(codexState.unlockedCards[0].obtainedCount).toBe(2);
    });

    it('should never select ending card in normal rounds', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'barreleye', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'humpback-anglerfish', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'dumbo-octopus', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'mariana-snailfish', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      // Even at 10900m with all normal cards unlocked
      const result = codexManager.selectCardForRound(10900, codexState, false);
      
      // Should return a duplicate of shallowest reachable card (Moon jellyfish)
      expect(result.card.id).toBe('moon-jellyfish');
      expect(result.isDuplicate).toBe(true);
      
      // Should NEVER return ending card
      expect(result.card.isEndingCard).toBe(false);
    });

    it('should handle zone boundaries correctly', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      // At exactly 200m, Twilight zone starts (200-1000m)
      // First round should unlock Moon jellyfish (Sunlit 0-200m)
      const result = codexManager.selectCardForRound(200, codexState, false);
      expect(result.card.id).toBe('moon-jellyfish');
      
      // Now at 200m with Moon jellyfish unlocked, should get Barreleye
      const result2 = codexManager.selectCardForRound(200, codexState, false);
      expect(result2.card.id).toBe('barreleye');
      expect(result2.card.zone).toBe('Twilight');
    });
  });

  describe('selectCardForRound - edge cases', () => {
    it('should handle depth 0', () => {
      const codexState: CodexState = { unlockedCards: [] };
      
      const result = codexManager.selectCardForRound(0, codexState, false);
      
      expect(result.card.id).toBe('moon-jellyfish');
    });

    it('should handle maximum depth 10900', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'barreleye', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'humpback-anglerfish', unlockedAt: Date.now(), obtainedCount: 1 },
          { cardId: 'dumbo-octopus', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      const result = codexManager.selectCardForRound(10900, codexState, false);
      
      // Should unlock Mariana snailfish (last normal card)
      expect(result.card.id).toBe('mariana-snailfish');
    });

    it('should increment obtainedCount correctly for duplicates', () => {
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: Date.now(), obtainedCount: 1 }
        ]
      };
      
      // Get duplicate 3 times
      codexManager.selectCardForRound(150, codexState, false);
      codexManager.selectCardForRound(150, codexState, false);
      codexManager.selectCardForRound(150, codexState, false);
      
      expect(codexState.unlockedCards[0].obtainedCount).toBe(4);
    });

    it('should preserve unlockedAt timestamp for duplicates', () => {
      const originalTimestamp = 1000000;
      const codexState: CodexState = {
        unlockedCards: [
          { cardId: 'moon-jellyfish', unlockedAt: originalTimestamp, obtainedCount: 1 }
        ]
      };
      
      codexManager.selectCardForRound(150, codexState, false);
      
      expect(codexState.unlockedCards[0].unlockedAt).toBe(originalTimestamp);
    });
  });
});
