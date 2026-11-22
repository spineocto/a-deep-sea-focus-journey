/**
 * Button Visibility Tests
 * 
 * Tests the updateButtonVisibility function to ensure buttons are shown/hidden correctly
 * based on the current application state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppState } from '../state-machine';
import { updateButtonVisibility } from '../main';

describe('Button Visibility Logic', () => {
  // Mock DOM elements
  let mockElements: Record<string, HTMLElement | null>;

  beforeEach(() => {
    // Reset mocks
    mockElements = {};
    
    // Mock document.getElementById
    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (!mockElements[id]) {
        const element = document.createElement(
          id.includes('button') || id.includes('toggle') ? 'button' : 'div'
        );
        element.id = id;
        element.classList.add('hidden'); // Start hidden
        mockElements[id] = element;
      }
      return mockElements[id];
    });
  });

  describe('IDLE state', () => {
    it('should show duration selection and start button', () => {
      updateButtonVisibility(AppState.IDLE, false);

      const durationSelection = mockElements['duration-selection'];
      const startButton = mockElements['start-button'];

      expect(durationSelection?.classList.contains('hidden')).toBe(false);
      expect(startButton?.classList.contains('hidden')).toBe(false);
    });

    it('should hide abandon, skip, and ending buttons', () => {
      updateButtonVisibility(AppState.IDLE, false);

      const abandonButton = mockElements['abandon-button'];
      const skipBreakButton = mockElements['skip-break-button'];
      const endingConfirmButton = mockElements['ending-confirm-button'];

      expect(abandonButton?.classList.contains('hidden')).toBe(true);
      expect(skipBreakButton?.classList.contains('hidden')).toBe(true);
      expect(endingConfirmButton?.classList.contains('hidden')).toBe(true);
    });

    it('should show subtle dive again button when endingSeen is true', () => {
      updateButtonVisibility(AppState.IDLE, true);

      const diveAgainSubtleButton = mockElements['dive-again-subtle-button'];
      expect(diveAgainSubtleButton?.classList.contains('hidden')).toBe(false);
    });

    it('should hide subtle dive again button when endingSeen is false', () => {
      updateButtonVisibility(AppState.IDLE, false);

      const diveAgainSubtleButton = mockElements['dive-again-subtle-button'];
      expect(diveAgainSubtleButton?.classList.contains('hidden')).toBe(true);
    });

    it('should enable demo mode toggle and clear data button', () => {
      updateButtonVisibility(AppState.IDLE, false);

      const demoModeToggle = mockElements['demo-mode-toggle'] as HTMLButtonElement;
      const clearDataButton = mockElements['clear-data-button'] as HTMLButtonElement;

      expect(demoModeToggle?.disabled).toBe(false);
      expect(clearDataButton?.disabled).toBe(false);
    });

    it('should disable test distraction button', () => {
      updateButtonVisibility(AppState.IDLE, false);

      const testDistractionButton = mockElements['test-distraction-button'] as HTMLButtonElement;
      expect(testDistractionButton?.disabled).toBe(true);
    });

    it('should keep START enabled so a click can hint when no duration is chosen', () => {
      // Regression: START used to be disabled until a duration was picked,
      // so clicking it did nothing. It must stay enabled; the click handler
      // guards the no-selection case and shows a gentle hint instead.
      updateButtonVisibility(AppState.IDLE, false);

      const startButton = mockElements['start-button'] as HTMLButtonElement;
      expect(startButton?.disabled).toBe(false);
    });
  });

  describe('FOCUSING state', () => {
    it('should show only abandon button', () => {
      updateButtonVisibility(AppState.FOCUSING, false);

      const abandonButton = mockElements['abandon-button'];
      const durationSelection = mockElements['duration-selection'];
      const startButton = mockElements['start-button'];
      const skipBreakButton = mockElements['skip-break-button'];

      expect(abandonButton?.classList.contains('hidden')).toBe(false);
      expect(durationSelection?.classList.contains('hidden')).toBe(true);
      expect(startButton?.classList.contains('hidden')).toBe(true);
      expect(skipBreakButton?.classList.contains('hidden')).toBe(true);
    });

    it('should enable test distraction button', () => {
      updateButtonVisibility(AppState.FOCUSING, false);

      const testDistractionButton = mockElements['test-distraction-button'] as HTMLButtonElement;
      expect(testDistractionButton?.disabled).toBe(false);
    });

    it('should disable demo mode toggle and clear data button', () => {
      updateButtonVisibility(AppState.FOCUSING, false);

      const demoModeToggle = mockElements['demo-mode-toggle'] as HTMLButtonElement;
      const clearDataButton = mockElements['clear-data-button'] as HTMLButtonElement;

      expect(demoModeToggle?.disabled).toBe(true);
      expect(clearDataButton?.disabled).toBe(true);
    });
  });

  describe('DISTRACTED state', () => {
    it('should show abandon button', () => {
      updateButtonVisibility(AppState.DISTRACTED, false);

      const abandonButton = mockElements['abandon-button'];
      expect(abandonButton?.classList.contains('hidden')).toBe(false);
    });

    it('should hide other action buttons', () => {
      updateButtonVisibility(AppState.DISTRACTED, false);

      const startButton = mockElements['start-button'];
      const skipBreakButton = mockElements['skip-break-button'];

      expect(startButton?.classList.contains('hidden')).toBe(true);
      expect(skipBreakButton?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('SHORT_BREAK state', () => {
    it('should show skip break button', () => {
      updateButtonVisibility(AppState.SHORT_BREAK, false);

      const skipBreakButton = mockElements['skip-break-button'];
      expect(skipBreakButton?.classList.contains('hidden')).toBe(false);
    });

    it('should hide other action buttons', () => {
      updateButtonVisibility(AppState.SHORT_BREAK, false);

      const abandonButton = mockElements['abandon-button'];
      const startButton = mockElements['start-button'];

      expect(abandonButton?.classList.contains('hidden')).toBe(true);
      expect(startButton?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('LONG_BREAK state', () => {
    it('should show skip break button', () => {
      updateButtonVisibility(AppState.LONG_BREAK, false);

      const skipBreakButton = mockElements['skip-break-button'];
      expect(skipBreakButton?.classList.contains('hidden')).toBe(false);
    });

    it('should hide other action buttons', () => {
      updateButtonVisibility(AppState.LONG_BREAK, false);

      const abandonButton = mockElements['abandon-button'];
      const startButton = mockElements['start-button'];

      expect(abandonButton?.classList.contains('hidden')).toBe(true);
      expect(startButton?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('ENDING state', () => {
    it('should show confirm and dive again buttons', () => {
      updateButtonVisibility(AppState.ENDING, false);

      const endingConfirmButton = mockElements['ending-confirm-button'];
      const diveAgainButton = mockElements['dive-again-button'];

      expect(endingConfirmButton?.classList.contains('hidden')).toBe(false);
      expect(diveAgainButton?.classList.contains('hidden')).toBe(false);
    });

    it('should hide other action buttons', () => {
      updateButtonVisibility(AppState.ENDING, false);

      const abandonButton = mockElements['abandon-button'];
      const startButton = mockElements['start-button'];
      const skipBreakButton = mockElements['skip-break-button'];

      expect(abandonButton?.classList.contains('hidden')).toBe(true);
      expect(startButton?.classList.contains('hidden')).toBe(true);
      expect(skipBreakButton?.classList.contains('hidden')).toBe(true);
    });

    it('should hide subtle dive again button', () => {
      updateButtonVisibility(AppState.ENDING, true);

      const diveAgainSubtleButton = mockElements['dive-again-subtle-button'];
      expect(diveAgainSubtleButton?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Button state across transitions', () => {
    it('should properly transition from IDLE to FOCUSING', () => {
      updateButtonVisibility(AppState.IDLE, false);
      let startButton = mockElements['start-button'];
      expect(startButton?.classList.contains('hidden')).toBe(false);

      updateButtonVisibility(AppState.FOCUSING, false);
      startButton = mockElements['start-button'];
      const abandonButton = mockElements['abandon-button'];

      expect(startButton?.classList.contains('hidden')).toBe(true);
      expect(abandonButton?.classList.contains('hidden')).toBe(false);
    });

    it('should properly transition from FOCUSING to SHORT_BREAK', () => {
      updateButtonVisibility(AppState.FOCUSING, false);
      let abandonButton = mockElements['abandon-button'];
      expect(abandonButton?.classList.contains('hidden')).toBe(false);

      updateButtonVisibility(AppState.SHORT_BREAK, false);
      abandonButton = mockElements['abandon-button'];
      const skipBreakButton = mockElements['skip-break-button'];

      expect(abandonButton?.classList.contains('hidden')).toBe(true);
      expect(skipBreakButton?.classList.contains('hidden')).toBe(false);
    });

    it('should properly transition from ENDING to IDLE with endingSeen', () => {
      updateButtonVisibility(AppState.ENDING, false);
      let diveAgainButton = mockElements['dive-again-button'];
      expect(diveAgainButton?.classList.contains('hidden')).toBe(false);

      updateButtonVisibility(AppState.IDLE, true);
      diveAgainButton = mockElements['dive-again-button'];
      const diveAgainSubtleButton = mockElements['dive-again-subtle-button'];
      const startButton = mockElements['start-button'];

      expect(diveAgainButton?.classList.contains('hidden')).toBe(true);
      expect(diveAgainSubtleButton?.classList.contains('hidden')).toBe(false);
      expect(startButton?.classList.contains('hidden')).toBe(false);
    });
  });
});
