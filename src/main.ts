// focus-core 主入口
import { AppState } from './state-machine.js';
import { createAppController } from './app-controller.js';
import { timer } from './timer.js';
import { demoMode } from './demo-mode.js';
import { storage } from './storage.js';
import { CREATURE_CARDS } from './codex-manager.js';
import { createDepthCalculator } from './depth-calculator.js';
import { distractionDetector } from './distraction-detector.js';
import { createAudioController } from './audio.js';
import { createAmbientLayer, zoneIndexForDepth } from './ambient.js';
import { Config } from './config.js';
import { CREATURE_ART } from './creature-art.js';
import eyeUrl from '../art/out/eye.webp';
import bellNormalUrl from '../art/out/bell-normal.webp';
import bellAlertUrl from '../art/out/bell-alert.webp';
import bellSleepingUrl from '../art/out/bell-sleeping.webp';

// 應用程式控制器實例
const appController = createAppController();
const depthCalculator = createDepthCalculator();
// 動效層：背景 crossfade + 雪 / 氣泡 / 光柱 / 呼吸光 / 聲納
// （背景 PNG 本身不動，動的是蓋在上面的透明層）
const ambient = createAmbientLayer();
const audio = createAudioController();

// 選定的時長（分鐘）
let selectedDuration: number | null = null;

// 追蹤上一次的狀態用於偵測卡片揭露
let previousState: AppState | null = null;
let previousCodexCount = 0;

/**
 * 更新按鈕顯示/隱藏狀態
 * 
 * 根據當前應用程式狀態決定哪些按鈕應該顯示
 * 
 * @param currentState - 當前的應用程式狀態
 * @param endingSeen - 是否已經看過 ENDING 狀態（用於顯示低調的 Dive Again 按鈕）
 */
export function updateButtonVisibility(currentState: AppState, endingSeen: boolean): void {
  // 取得 DOM 元素參照
  const durationSelection = document.getElementById('duration-selection');
  const startButton = document.getElementById('start-button');
  const abandonButton = document.getElementById('abandon-button');
  const skipBreakButton = document.getElementById('skip-break-button');
  const endingConfirmButton = document.getElementById('ending-confirm-button');
  const diveAgainButton = document.getElementById('dive-again-button');
  const diveAgainSubtleButton = document.getElementById('dive-again-subtle-button');
  const testDistractionButton = document.getElementById('test-distraction-button') as HTMLButtonElement | null;
  const demoModeToggle = document.getElementById('demo-mode-toggle') as HTMLButtonElement | null;
  const clearDataButton = document.getElementById('clear-data-button') as HTMLButtonElement | null;

  // 隱藏所有按鈕（預設）
  durationSelection?.classList.add('hidden');
  startButton?.classList.add('hidden');
  abandonButton?.classList.add('hidden');
  skipBreakButton?.classList.add('hidden');
  endingConfirmButton?.classList.add('hidden');
  diveAgainButton?.classList.add('hidden');
  diveAgainSubtleButton?.classList.add('hidden');

  // 根據狀態顯示對應的按鈕
  switch (currentState) {
    case AppState.IDLE:
      // IDLE: 顯示時長選擇、START 按鈕、測試/清除按鈕
      durationSelection?.classList.remove('hidden');
      startButton?.classList.remove('hidden');
      
      // 如果已經看過 ENDING，顯示低調的 Dive Again 按鈕
      if (endingSeen) {
        diveAgainSubtleButton?.classList.remove('hidden');
      }
      break;

    case AppState.FOCUSING:
      // FOCUSING: 顯示 ABANDON 按鈕
      abandonButton?.classList.remove('hidden');
      break;

    case AppState.DISTRACTED:
      // DISTRACTED: 可以放棄
      abandonButton?.classList.remove('hidden');
      break;

    case AppState.SHORT_BREAK:
    case AppState.LONG_BREAK:
      // 休息狀態: 顯示 SKIP BREAK 按鈕
      skipBreakButton?.classList.remove('hidden');
      break;

    case AppState.ENDING:
      // ENDING: 顯示 CONFIRM 和主要的 DIVE AGAIN 按鈕
      endingConfirmButton?.classList.remove('hidden');
      diveAgainButton?.classList.remove('hidden');
      break;
  }

  // Demo Mode 切換和清除資料按鈕只在 IDLE 狀態可用
  if (demoModeToggle) {
    if (currentState === AppState.IDLE) {
      demoModeToggle.disabled = false;
    } else {
      demoModeToggle.disabled = true;
    }
  }

  // 測試分心按鈕只在 FOCUSING 狀態可用
  if (testDistractionButton) {
    if (currentState === AppState.FOCUSING) {
      testDistractionButton.disabled = false;
    } else {
      testDistractionButton.disabled = true;
    }
  }

  // 清除資料按鈕只在 IDLE 狀態可用
  if (clearDataButton) {
    if (currentState === AppState.IDLE) {
      clearDataButton.disabled = false;
    } else {
      clearDataButton.disabled = true;
    }
  }
  
  // 啟用/停用 START 按鈕（需選擇時長）
  if (startButton) {
    (startButton as HTMLButtonElement).disabled = selectedDuration === null;
  }
}

const OXYGEN_DRAIN = 0.65; // oxygen never drops below 35% during a round
let lastOxygen = 1;
let codexKey = '';

const CAPTIONS: Record<AppState, string> = {
  [AppState.IDLE]: 'READY',
  [AppState.FOCUSING]: 'DESCENDING',
  [AppState.DISTRACTED]: 'WARNING: SOMETHING IS WATCHING YOU',
  [AppState.SHORT_BREAK]: 'OXYGEN REFILLING',
  [AppState.LONG_BREAK]: 'DOCKED BESIDE THE WRECK',
  [AppState.ENDING]: 'SIGNAL DETECTED BELOW THE KNOWN DEPTH.',
};

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function renderCodex(unlocked: { cardId: string; obtainedCount: number }[]): void {
  const key = unlocked.map(u => `${u.cardId}:${u.obtainedCount}`).join('|');
  if (key === codexKey) return;
  codexKey = key;
  setText('codex-count', `${unlocked.length}/${CREATURE_CARDS.length}`);
  const list = document.getElementById('codex-display');
  if (!list) return;
  list.innerHTML = CREATURE_CARDS.map(card => {
    const hit = unlocked.find(u => u.cardId === card.id);
    const art = CREATURE_ART[card.id] ?? '';
    if (!hit) {
      return `<div class="codex-item locked"><div class="codex-art"><img src="${art}" alt="" /><span class="codex-q">?</span></div><span class="codex-item-name">Unknown</span><span class="codex-item-sub">${card.zone}</span></div>`;
    }
    return `<div class="codex-item"><div class="codex-art lit"><img src="${art}" alt="${card.commonNameEn}" /></div><span class="codex-item-name">${card.commonNameEn}</span><span class="codex-item-sub">${card.zone} <span class="mono">x${hit.obtainedCount}</span></span></div>`;
  }).join('');
}

/**
 * 更新 UI 顯示
 */
function updateUI(): void {
  const state = appController.getState();
  const currentState = state.stateMachine.getState();
  const timerState = state.timerState;
  const depthState = state.depthState;
  
  // 偵測卡片揭露（當從 FOCUSING 轉換到 BREAK/ENDING 且卡片數量增加）
  if (previousState === AppState.FOCUSING && 
      (currentState === AppState.SHORT_BREAK || 
       currentState === AppState.LONG_BREAK || 
       currentState === AppState.ENDING)) {
    
    const currentCodexCount = state.codexState.unlockedCards.length;
    
    if (currentCodexCount > previousCodexCount || previousCodexCount === 0) {
      // 有新卡片解鎖或是第一次（顯示最新的卡片）
      const latestCard = state.codexState.unlockedCards[state.codexState.unlockedCards.length - 1];
      if (latestCard) {
        const isDuplicate = latestCard.obtainedCount > 1;
        showCardReveal(latestCard.cardId, isDuplicate);
      }
    }
    
    previousCodexCount = state.codexState.unlockedCards.length;
  }
  
  // 更新前一次狀態
  previousState = currentState;
  
  const now = Date.now();
  const scene = document.getElementById('app');
  const currentDepth = depthCalculator.getCurrentTotalDepth(depthState);
  const zoneIdx = zoneIndexForDepth(currentDepth);
  const breakInfo = appController.getBreakProgress();

  // 1. Caption under the timer. The two English system lines are fixed
  //    (never reworded), see .kiro/steering/product.md.
  setText('state-display', CAPTIONS[currentState]);

  // 2. Timer: remaining focus time, remaining break time, or the chosen length.
  let timeText = '--:--';
  let remainingMs: number | null = null;
  if (timerState && (currentState === AppState.FOCUSING || currentState === AppState.DISTRACTED)) {
    remainingMs = timer.getRemainingTime(timerState, now);
  } else if (breakInfo) {
    remainingMs = breakInfo.remainingMs;
  } else if (currentState === AppState.IDLE && selectedDuration !== null) {
    remainingMs = selectedDuration * 60 * 1000;
  }
  if (remainingMs !== null) {
    timeText = formatClock(remainingMs);
  }
  setText('time-display', timeText);

  // 3. Oxygen ring: drains slowly while focusing (never below 35%, never
  //    forces a stop), refills during a break.
  let oxygen = 1;
  if (timerState && (currentState === AppState.FOCUSING || currentState === AppState.DISTRACTED)) {
    const total = timerState.selectedDurationMs;
    const progress = total > 0 ? 1 - Math.max(0, remainingMs ?? 0) / total : 0;
    oxygen = 1 - OXYGEN_DRAIN * Math.min(1, Math.max(0, progress));
    lastOxygen = oxygen;
  } else if (breakInfo && breakInfo.durationMs > 0) {
    const refill = 1 - breakInfo.remainingMs / breakInfo.durationMs;
    oxygen = lastOxygen + (1 - lastOxygen) * Math.min(1, Math.max(0, refill));
  } else {
    lastOxygen = 1;
  }
  scene?.style.setProperty('--oxygen', oxygen.toFixed(4));

  // 4. Depth readouts + the hairline marker on the left edge.
  setText('total-depth-display', `${Math.floor(currentDepth).toLocaleString('en-US')} m`);
  const netDescent = Math.max(0, depthState.roundDescentDepth - depthState.roundRisePenalty);
  setText('descent-depth-display', `${Math.floor(netDescent)} m`);
  document.getElementById('descent-wrap')?.classList.toggle(
    'hidden',
    !(currentState === AppState.FOCUSING || currentState === AppState.DISTRACTED),
  );
  setText('zone-display', depthCalculator.getZone(currentDepth));
  setText('rounds-display', state.completedRounds.toString());
  const pct = Math.min(100, (currentDepth / Config.targetDepth) * 100);
  scene?.style.setProperty('--depth-pct', pct.toFixed(3));

  // 5. Scene attributes: CSS reads these for mood, zone and state.
  if (scene) {
    scene.setAttribute('data-state', currentState);
    scene.setAttribute('data-zone', String(zoneIdx));
    const mood =
      currentState === AppState.DISTRACTED
        ? 'alert'
        : currentState === AppState.SHORT_BREAK || currentState === AppState.LONG_BREAK
          ? 'sleeping'
          : 'normal';
    scene.setAttribute('data-mood', mood);
  }

  // Ambience plays only while actively focusing.
  if (currentState === AppState.FOCUSING || currentState === AppState.DISTRACTED) {
    audio.startAmbience();
  } else {
    audio.stopAmbience();
  }

  // 6. Codex list (only re-rendered when it changes).
  renderCodex(state.codexState.unlockedCards);

  // 7. Demo mode indicator.
  document.getElementById('demo-indicator')?.classList.toggle('active', state.isDemoMode);

  // 8. Document title doubles as a quiet timer.
  document.title =
    remainingMs !== null && currentState !== AppState.IDLE
      ? `${timeText} - Deep Sea Focus Journey`
      : 'Deep Sea Focus Journey';

  // 9. 更新動效層：用本輪淨深度（不是已結算的總深度），
  // 這樣專注進行中背景就會慢慢下沉、慢慢變暗。
  ambient.update(
    depthCalculator.getCurrentTotalDepth(depthState),
    currentState,
    Date.now(),
  );

  // 10. 更新按鈕可見性
  updateButtonVisibility(currentState, state.endingSeen);
}

/**
 * 顯示卡片揭露模態框
 */
function showCardReveal(cardId: string, isDuplicate: boolean): void {
  const card = CREATURE_CARDS.find(c => c.id === cardId);
  if (!card) return;
  
  const modal = document.getElementById('card-reveal');
  const cardName = document.getElementById('card-name');
  const cardScientificName = document.getElementById('card-scientific-name');
  const cardZone = document.getElementById('card-zone');
  const cardDepthRange = document.getElementById('card-depth-range');
  const cardFacts = document.getElementById('card-facts');
  
  if (!modal || !cardName || !cardScientificName || !cardZone || !cardDepthRange || !cardFacts) {
    return;
  }
  
  // 設定卡片內容
  setText('card-kicker', isDuplicate ? 'FIELD LOG / DUPLICATE RECORD' : 'FIELD LOG / NEW SPECIES');
  cardName.textContent = card.commonNameEn;
  setText('card-zh', card.commonNameZh);
  cardScientificName.textContent = card.scientificName;
  cardZone.textContent = card.zone;
  cardDepthRange.textContent = card.depthRange;
  cardFacts.textContent = card.facts;

  // Searchlight reveal: new species get the sweep, duplicates show lit at once.
  const art = CREATURE_ART[card.id] ?? '';
  const stage = document.getElementById('card-art');
  (document.getElementById('card-art-sil') as HTMLImageElement | null)?.setAttribute('src', art);
  (document.getElementById('card-art-lit') as HTMLImageElement | null)?.setAttribute('src', art);
  if (stage) {
    stage.classList.remove('reveal-run', 'reveal-done');
    void stage.offsetWidth; // restart the CSS animation
    stage.classList.add(isDuplicate ? 'reveal-done' : 'reveal-run');
  }
  // The ending card is followed by the final fixed line.
  const signal = document.getElementById('card-signal');
  signal?.classList.toggle('hidden', !card.isEndingCard);

  // 顯示模態框
  audio.ping();
  modal.classList.add('active');
}

/**
 * 隱藏卡片揭露模態框
 */
function hideCardReveal(): void {
  const modal = document.getElementById('card-reveal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * 手動觸發分心測試
 * 
 * 模擬隱藏 6 秒（超過 5 秒閾值）的分心事件。
 * 只在 FOCUSING 狀態可用。
 */
function handleTestDistraction(): void {
  const state = appController.getState();
  const currentState = state.stateMachine.getState();
  
  // 只在 FOCUSING 狀態可用
  if (currentState !== AppState.FOCUSING) {
    console.warn('Test distraction only available in FOCUSING state');
    return;
  }
  
  const timerState = state.timerState;
  if (!timerState) {
    console.error('Timer state not found');
    return;
  }
  
  // 模擬隱藏 6 秒（超過 5 秒閾值）
  const nowMs = Date.now();
  const sixSecondsAgo = nowMs - 6000;
  
  // 手動設定 hiddenAt 為 6 秒前
  timerState.hiddenAt = sixSecondsAgo;
  
  // 呼叫 markVisible 計算隱藏時長
  const { state: newTimerState, hiddenRealMs, hiddenDuration } = timer.markVisible(
    timerState,
    nowMs
  );
  
  // 更新 timer state
  state.timerState = newTimerState;
  
  // 判斷是否觸發分心（應該會觸發，因為 6 秒 > 5 秒）
  const event = distractionDetector.checkDistraction(hiddenRealMs);
  
  if (event.triggered) {
    // 轉換到 DISTRACTED 狀態
    state.stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
    appController.markDistractionStart();
    
    // 計算上浮懲罰
    const penalty = distractionDetector.calculateRisePenalty(
      state.depthState.roundDescentDepth
    );
    
    // 應用上浮懲罰
    const depthCalculator = createDepthCalculator();
    state.depthState = depthCalculator.applyRisePenalty(state.depthState, penalty);
    
    // 將隱藏時間加入懲罰
    state.timerState = timer.applyDistractionPenalty(state.timerState, hiddenDuration);
    
    // 儲存狀態
    appController.save();
    
    if (import.meta.env.DEV) {
      console.log('Test distraction triggered:', {
        hiddenRealMs,
        hiddenDuration,
        penalty,
        newRisePenalty: state.depthState.roundRisePenalty
      });
    }
  } else {
    console.warn('Test distraction did not trigger (should not happen)');
  }
}

/**
 * RAF 循環
 */
function rafLoop(): void {
  // 更新應用程式控制器
  appController.update();
  
  // 更新 UI
  updateUI();
  
  // 繼續循環
  requestAnimationFrame(rafLoop);
}

/**
 * 初始化應用程式
 */
function initApp(): void {
  // 00. Bell sprites
  const sprites: Array<[string, string]> = [
    ['bell-normal', bellNormalUrl],
    ['bell-alert', bellAlertUrl],
    ['bell-sleeping', bellSleepingUrl],
    ['eye-far', eyeUrl],
    ['eye-giant', eyeUrl],
  ];
  for (const [id, url] of sprites) {
    const img = document.getElementById(id) as HTMLImageElement | null;
    if (img) img.src = url;
  }

  // 00b. Debug panel: hidden unless ?debug=1 or Shift+D. Codex drawer toggle.
  const debugPanel = document.getElementById('debug-panel');
  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    debugPanel?.classList.remove('hidden');
  }
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) {
      debugPanel?.classList.toggle('hidden');
    }
    if (e.key === 'Escape') setCodexOpen(false);
  });
  const codexToggle = document.getElementById('codex-toggle');
  const codexPanel = document.getElementById('codex-panel');
  const setCodexOpen = (open: boolean): void => {
    if (!codexPanel) return;
    codexPanel.hidden = !open;
    codexToggle?.setAttribute('aria-expanded', String(open));
  };
  codexToggle?.addEventListener('click', () => setCodexOpen(codexPanel?.hidden ?? false));
  document.getElementById('codex-close')?.addEventListener('click', () => setCodexOpen(false));

  // Sound toggle (muted by default).
  const soundToggle = document.getElementById('sound-toggle');
  const syncSoundToggle = (): void => {
    if (!soundToggle) return;
    const on = audio.isEnabled();
    soundToggle.textContent = on ? 'SOUND ON' : 'SOUND OFF';
    soundToggle.setAttribute('aria-pressed', String(on));
    soundToggle.classList.toggle('faint', !on);
  };
  syncSoundToggle();
  soundToggle?.addEventListener('click', () => {
    audio.setEnabled(!audio.isEnabled());
    syncSoundToggle();
  });

  // 0. 掛載動效層（背景 + 透明動效，尊重 prefers-reduced-motion）
  ambient.mount();
  const motionToggle = document.getElementById('motion-toggle');
  const syncMotionToggle = (): void => {
    if (motionToggle) {
      motionToggle.textContent = ambient.isMotionEnabled()
        ? 'Motion: On'
        : 'Motion: Off';
    }
  };
  syncMotionToggle();
  motionToggle?.addEventListener('click', () => {
    ambient.setMotionEnabled(!ambient.isMotionEnabled());
    syncMotionToggle();
  });

  // 1. 初始化 AppController（載入存檔、註冊事件監聽器）
  appController.init();
  
  // 初始化追蹤變數
  const initialState = appController.getState();
  previousState = initialState.stateMachine.getState();
  previousCodexCount = initialState.codexState.unlockedCards.length;
  
  // 2. 綁定時長選擇按鈕
  const duration15 = document.getElementById('duration-15');
  const duration25 = document.getElementById('duration-25');
  const duration45 = document.getElementById('duration-45');
  
  const durationButtons = [duration15, duration25, duration45];
  
  durationButtons.forEach(button => {
    button?.addEventListener('click', () => {
      const durationStr = button.getAttribute('data-duration');
      if (durationStr) {
        selectedDuration = parseInt(durationStr, 10);
        
        // 高亮選中的按鈕
        durationButtons.forEach(btn => btn?.classList.remove('selected'));
        button.classList.add('selected');
        
        // 更新 UI（啟用 START 按鈕）
        updateUI();
      }
    });
  });
  
  // 3. 綁定 START DESCENT 按鈕
  const startButton = document.getElementById('start-button');
  startButton?.addEventListener('click', () => {
    if (selectedDuration !== null) {
      const success = appController.handleStartFocus(selectedDuration);
      if (success) {
        // 清除選擇
        selectedDuration = null;
        durationButtons.forEach(btn => btn?.classList.remove('selected'));
      }
    }
  });
  
  // 4. 綁定 ABANDON 按鈕
  const abandonButton = document.getElementById('abandon-button');
  abandonButton?.addEventListener('click', () => {
    appController.handleAbandonRound();
  });
  
  // 5. 綁定 SKIP BREAK 按鈕
  const skipBreakButton = document.getElementById('skip-break-button');
  skipBreakButton?.addEventListener('click', () => {
    appController.handleSkipBreak();
  });
  
  // 6. 綁定 CONFIRM (ENDING) 按鈕
  const endingConfirmButton = document.getElementById('ending-confirm-button');
  endingConfirmButton?.addEventListener('click', () => {
    appController.handleEndingConfirmed();
  });
  
  // 7. 綁定 DIVE AGAIN 按鈕（兩個）
  const diveAgainButton = document.getElementById('dive-again-button');
  const diveAgainSubtleButton = document.getElementById('dive-again-subtle-button');
  
  diveAgainButton?.addEventListener('click', () => {
    appController.handleDiveAgain();
  });
  
  diveAgainSubtleButton?.addEventListener('click', () => {
    appController.handleDiveAgain();
  });
  
  // 8. 綁定 Toggle Demo Mode 按鈕
  const demoModeToggle = document.getElementById('demo-mode-toggle');
  demoModeToggle?.addEventListener('click', () => {
    const currentState = appController.getState().stateMachine.getState();
    
    if (currentState !== AppState.IDLE) {
      alert('Can only toggle demo mode in IDLE state');
      return;
    }
    
    // 儲存當前模式資料
    appController.save();
    
    // 切換 Demo Mode
    const newState = demoMode.toggle();
    if (import.meta.env.DEV) {
      console.log(`Demo Mode: ${newState ? 'ENABLED' : 'DISABLED'}`);
    }
    
    // 重新載入對應模式的資料
    appController.restoreFromStorage();
    
    // 更新 UI
    updateUI();
  });
  
  // 9. 綁定 Clear All Data 按鈕（需二次確認）
  const clearDataButton = document.getElementById('clear-data-button');
  clearDataButton?.addEventListener('click', () => {
    const confirmed = confirm('Are you sure you want to clear ALL data? This action cannot be undone!');
    if (confirmed) {
      storage.clearAll();
      
      // 重新載入頁面以重置狀態
      window.location.reload();
    }
  });
  
  // 10. 綁定卡片揭露關閉按鈕
  const cardCloseButton = document.getElementById('card-close-button');
  cardCloseButton?.addEventListener('click', () => {
    hideCardReveal();
  });
  
  // 11. 綁定「測試分心」按鈕
  const testDistractionButton = document.getElementById('test-distraction-button');
  testDistractionButton?.addEventListener('click', () => {
    handleTestDistraction();
  });
  
  // 12. 初始化 UI
  updateUI();
  
  // 13. 啟動 RAF 循環
  requestAnimationFrame(rafLoop);
}

// 當 DOM 載入完成後初始化
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}
