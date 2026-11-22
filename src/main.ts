// focus-core 主入口
import { AppState } from './state-machine.js';
import { createAppController } from './app-controller.js';
import { timer } from './timer.js';
import { demoMode } from './demo-mode.js';
import { storage } from './storage.js';
import { CREATURE_CARDS } from './codex-manager.js';
import { createDepthCalculator } from './depth-calculator.js';
import { distractionDetector } from './distraction-detector.js';
import { createAmbientLayer } from './ambient.js';

// 應用程式控制器實例
const appController = createAppController();
const depthCalculator = createDepthCalculator();
// 動效層：背景 crossfade + 雪 / 氣泡 / 光柱 / 呼吸光 / 聲納
// （背景 PNG 本身不動，動的是蓋在上面的透明層）
const ambient = createAmbientLayer();

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
  
  // 1. 更新狀態顯示
  const stateDisplay = document.getElementById('state-display');
  if (stateDisplay) {
    stateDisplay.textContent = currentState;
  }
  
  // 2. 更新時間顯示
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    if (timerState && (currentState === AppState.FOCUSING || currentState === AppState.DISTRACTED)) {
      const remaining = timer.getRemainingTime(timerState, Date.now());
      const minutes = Math.floor(remaining / 1000 / 60);
      const seconds = Math.floor((remaining / 1000) % 60);
      timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      timeDisplay.textContent = '--:--';
    }
  }
  
  // 3. 更新總深度顯示
  const totalDepthDisplay = document.getElementById('total-depth-display');
  if (totalDepthDisplay) {
    totalDepthDisplay.textContent = `${Math.floor(depthState.totalDepth)} m`;
  }
  
  // 4. 更新本輪深度顯示（淨深度 = 下沉深度 - 上浮懲罰）
  const descentDepthDisplay = document.getElementById('descent-depth-display');
  if (descentDepthDisplay) {
    const netDescent = Math.max(0, depthState.roundDescentDepth - depthState.roundRisePenalty);
    descentDepthDisplay.textContent = `${Math.floor(netDescent)} m`;
  }
  
  // 5. 更新當前區域顯示
  const zoneDisplay = document.getElementById('zone-display');
  if (zoneDisplay) {
    const zone = depthCalculator.getZone(depthState.totalDepth);
    zoneDisplay.textContent = zone;
  }
  
  // 6. 更新完成輪數顯示
  const roundsDisplay = document.getElementById('rounds-display');
  if (roundsDisplay) {
    roundsDisplay.textContent = state.completedRounds.toString();
  }
  
  // 7. 更新圖鑑清單顯示
  const codexDisplay = document.getElementById('codex-display');
  if (codexDisplay) {
    if (state.codexState.unlockedCards.length === 0) {
      codexDisplay.innerHTML = '<div style="color: #607d8b; font-style: italic;">No creatures discovered yet...</div>';
    } else {
      codexDisplay.innerHTML = state.codexState.unlockedCards
        .map(unlocked => {
          const card = CREATURE_CARDS.find(c => c.id === unlocked.cardId);
          if (!card) return '';
          return `
            <div class="codex-item">
              <div class="codex-item-name">${card.commonNameZh}</div>
              <div class="codex-item-count">×${unlocked.obtainedCount}</div>
            </div>
          `;
        })
        .join('');
    }
  }
  
  // 8. 更新深度進度條
  const depthProgressBar = document.getElementById('depth-progress-bar');
  const depthProgressText = document.getElementById('depth-progress-text');
  if (depthProgressBar && depthProgressText) {
    const targetDepth = 10900;
    const percentage = Math.min(100, (depthState.totalDepth / targetDepth) * 100);
    depthProgressBar.style.width = `${percentage}%`;
    depthProgressText.textContent = `${Math.floor(depthState.totalDepth)} / ${targetDepth.toLocaleString()} m (${percentage.toFixed(1)}%)`;
  }
  
  // 9. 更新 Demo 模式指示器
  const demoIndicator = document.getElementById('demo-indicator');
  if (demoIndicator) {
    if (state.isDemoMode) {
      demoIndicator.classList.add('active');
    } else {
      demoIndicator.classList.remove('active');
    }
  }
  
  // 10. 更新動效層：用本輪淨深度（不是已結算的總深度），
  // 這樣專注進行中背景就會慢慢下沉、慢慢變暗。
  ambient.update(
    depthCalculator.getCurrentTotalDepth(depthState),
    currentState,
    Date.now(),
  );

  // 11. 更新按鈕可見性
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
  if (isDuplicate) {
    cardName.textContent = `${card.commonNameZh} (again!)`;
  } else {
    cardName.textContent = `New Creature: ${card.commonNameZh}`;
  }
  cardScientificName.textContent = card.scientificName;
  cardZone.textContent = card.zone;
  cardDepthRange.textContent = card.depthRange;
  cardFacts.textContent = card.facts;
  
  // 顯示模態框
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
