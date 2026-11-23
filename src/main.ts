// focus-core 主入口
import { applyInk } from './ink.js';
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
import {
  getDepthOverride,
  setDepthOverride,
  startPreview,
  applyUrlOverrides,
  initDebugControls,
  updateZoneTitle,
  buildDepthTicks,
  updateDepthTicks,
} from './preview.js';
import { CREATURE_ART } from './creature-art.js';
import paperUrl from '../art/out/paper.webp';
import { renderPageHtml, sampleDiveLogPage, exportPagePng, escapeHtml } from './dive-log-render.js';
import { formatLogDate, logFilename, type DiveLogPage } from './dive-log.js';
import { eyeCaption } from './session.js';
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
/** Debug: pin the eye level (?eye=1|2|3) regardless of real distractions. */
let eyeLevelOverride: number | null = null;

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
  
  // START stays enabled even with no duration selected, so the click can
  // show a gentle hint (pulse the duration row) rather than doing nothing.
  if (startButton) {
    (startButton as HTMLButtonElement).disabled = false;
  }
}

const OXYGEN_DRAIN = 0.65; // oxygen never drops below 35% during a round
let lastOxygen = 1;
let codexKey = '';
/** When true, updateUI leaves the codex drawer alone (debug showcase). */
let codexShowcaseLock = false;
let firstPaint = true;
let prevDepthForRate = 0;
let prevRateTime = 0;

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
    return `<div class="codex-item"><div class="codex-art lit"><img src="${art}" alt="${card.commonNameEn}" /></div><span class="codex-item-name" title="${card.commonNameEn}">${card.commonNameEn}</span><span class="codex-item-sub">${card.zone} <span class="num">x${hit.obtainedCount}</span></span></div>`;
  }).join('');
}

/**
 * Debug-only codex showcase. Renders a synthetic unlocked list into the
 * drawer and opens it, WITHOUT touching real storage. 'all' unlocks every
 * card; 'mixed' unlocks the first three and leaves the rest as silhouettes.
 */
export function showcaseCodex(mode: 'all' | 'mixed', open: (v: boolean) => void): void {
  const cards = mode === 'all' ? CREATURE_CARDS : CREATURE_CARDS.slice(0, 3);
  codexShowcaseLock = true;
  codexKey = '__showcase__' + mode; // bypass the real-state cache
  renderCodex(cards.map(c => ({ cardId: c.id, obtainedCount: 1 })));
  open(true);
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
  
  // Coming back after a distraction: the ink recedes and the companion peeks out.
  if (previousState === AppState.DISTRACTED && currentState === AppState.FOCUSING) {
    playReturn();
  }

  // 更新前一次狀態
  previousState = currentState;
  
  const now = Date.now();
  const scene = document.getElementById('app');
  const realDepth = depthCalculator.getCurrentTotalDepth(depthState);
  // In debug/preview a depth override drives the whole scene without
  // touching game state; otherwise the scene follows the real depth.
  const override = getDepthOverride();
  const currentDepth = override ?? realDepth;
  const zoneIdx = zoneIndexForDepth(currentDepth);
  const breakInfo = appController.getBreakProgress();

  // 1. Caption under the timer. The two English system lines are fixed
  //    (never reworded), see .kiro/steering/product.md.
  setText(
    'state-display',
    currentState === AppState.DISTRACTED
      ? eyeCaption(eyeLevelOverride ?? state.session.eyeLevel)
      : CAPTIONS[currentState],
  );

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

  // Continuous depth grading (0..1): the scene darkens, the light cone
  // narrows and the vignette tightens smoothly instead of in zone steps.
  const depthNorm = Math.min(1, currentDepth / Config.targetDepth);
  scene?.style.setProperty('--depth', depthNorm.toFixed(4));
  // Cable pays out as the bell sinks (scrolls the cable texture upward).
  document.documentElement.style.setProperty('--descend-px', `${(currentDepth % 1000).toFixed(1)}`);
  // Depth tick marks scroll upward behind the scene.
  updateDepthTicks(currentDepth);

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
    // Escalating eye: how close the watcher is (0..3), driven by the session.
    // A debug override (?eye=1|2|3) pins it for screenshots.
    const eyeLevel = eyeLevelOverride ?? state.session.eyeLevel;
    scene.setAttribute('data-eye', String(eyeLevel));
    scene.classList.toggle('eye-demo', eyeLevelOverride !== null);
  }

  // Quiet zone title on zone entry.
  updateZoneTitle(zoneIdx, firstPaint);
  firstPaint = false;

  // Ambience plays only while actively focusing.
  if (currentState === AppState.FOCUSING || currentState === AppState.DISTRACTED) {
    audio.startAmbience();
  } else {
    audio.stopAmbience();
  }

  // 6. Codex list (only re-rendered when it changes; skipped while the
  //    debug codex showcase has taken over the drawer).
  if (!codexShowcaseLock) renderCodex(state.codexState.unlockedCards);

  // 7. Demo mode indicator.
  document.getElementById('demo-indicator')?.classList.toggle('active', state.isDemoMode);

  // 8. Document title doubles as a quiet timer.
  document.title =
    remainingMs !== null && currentState !== AppState.IDLE
      ? `${timeText} - Deep Sea Focus Journey`
      : 'Deep Sea Focus Journey';

  // 9. 更新動效層：用當前顯示深度（含 debug/preview override），
  // 這樣專注進行中或預覽時背景就會慢慢下沉、慢慢變暗。
  // Descent rate (m/s) drives the upward drift speed of marine snow.
  let descentRate = 0;
  if (prevRateTime > 0) {
    const dt = (now - prevRateTime) / 1000;
    if (dt > 0) descentRate = (currentDepth - prevDepthForRate) / dt;
  }
  prevDepthForRate = currentDepth;
  prevRateTime = now;
  ambient.update(currentDepth, currentState, now, descentRate);

  // 10. 更新按鈕可見性
  updateButtonVisibility(currentState, state.endingSeen);

  // 11. Focus-goal slip: editable before the dive, pinned faintly during it.
  const goal = state.session.focusGoal;
  document.getElementById('goal-slip')?.classList.toggle('hidden', currentState !== AppState.IDLE);
  const diving = currentState === AppState.FOCUSING || currentState === AppState.DISTRACTED;
  const pin = document.getElementById('goal-pin');
  if (pin) {
    pin.classList.toggle('show', diving && goal.length > 0);
    setText('goal-pin-text', goal);
  }
  // 12. Dive log: the Log tab follows real state; a fresh page opens after the card.
  if (!logShowcaseLock) renderLogList(state.diveLog);
  showPendingDiveLog();
  const goalInput = document.getElementById('goal-input') as HTMLInputElement | null;
  if (goalInput && document.activeElement !== goalInput && goalInput.value !== goal) {
    goalInput.value = goal;
  }
}

/**
 * 顯示卡片揭露模態框
 */
let glanceTimer: number | null = null;
/** Slow turn-and-glance of the companion; CSS does the motion via .glance. */
function glanceCompanion(): void {
  const scene = document.getElementById('app');
  if (!scene) return;
  scene.classList.remove('glance');
  void scene.offsetWidth;
  scene.classList.add('glance');
  if (glanceTimer !== null) clearTimeout(glanceTimer);
  glanceTimer = window.setTimeout(() => scene.classList.remove('glance'), 6500);
}

function showCardReveal(cardId: string, isDuplicate: boolean, instant = false): void {
  const card = CREATURE_CARDS.find(c => c.id === cardId);
  if (!card) return;

  // The companion turns to look when a new creature is logged.
  glanceCompanion();

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
  (document.getElementById('card-art-ink') as HTMLImageElement | null)?.setAttribute('src', art);
  (document.getElementById('card-art-lit') as HTMLImageElement | null)?.setAttribute('src', art);
  if (stage) {
    stage.classList.remove('reveal-run', 'reveal-done');
    void stage.offsetWidth; // restart the CSS animation
    stage.classList.add(isDuplicate || instant ? 'reveal-done' : 'reveal-run');
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
  showPendingDiveLog();
}

// ---- Return reaction -------------------------------------------------------

let returnTimer: number | null = null;
const RETURN_MS = 8000;

/**
 * The reaction when the user comes back after looking away: ink recedes slowly,
 * the octopus peeks out, the cable creaks (sound only if on) and a handwritten
 * line appears. Pure presentation: it never touches the timer or state.
 */
function playReturn(): void {
  const scene = document.getElementById('app');
  if (!scene) return;
  scene.classList.remove('returning');
  void scene.offsetWidth; // restart the CSS animations
  scene.classList.add('returning');
  audio.creak();
  if (returnTimer !== null) clearTimeout(returnTimer);
  returnTimer = window.setTimeout(() => scene.classList.remove('returning'), RETURN_MS);
}

// ---- Dive log -------------------------------------------------------------

let pendingLogPage: DiveLogPage | null = null;
let shownLogPage: DiveLogPage | null = null;
let logKey = '';
let logShowcaseLock = false;

function showDiveLog(page: DiveLogPage): void {
  const host = document.getElementById('dive-log-page');
  const overlay = document.getElementById('dive-log');
  if (!host || !overlay) return;
  shownLogPage = page;
  host.innerHTML = renderPageHtml(page, CREATURE_ART[page.sketchCardId]);
  overlay.classList.add('active');
}

function hideDiveLog(): void {
  document.getElementById('dive-log')?.classList.remove('active');
  shownLogPage = null;
}

/** Show the page written at the end of a round, once no card is on screen. */
function showPendingDiveLog(): void {
  if (!pendingLogPage) return;
  if (document.getElementById('card-reveal')?.classList.contains('active')) return;
  const page = pendingLogPage;
  pendingLogPage = null;
  showDiveLog(page);
}

async function saveDiveLogPage(): Promise<void> {
  const page = shownLogPage;
  if (!page) return;
  const blob = await exportPagePng(page, CREATURE_ART[page.sketchCardId], paperUrl);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = logFilename(page);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function renderLogList(pages: readonly DiveLogPage[]): void {
  const key = pages.map(p => p.id).join('|');
  if (key === logKey) return;
  logKey = key;
  const list = document.getElementById('log-display');
  if (!list) return;
  if (pages.length === 0) {
    list.innerHTML = '<p class="log-empty">No pages yet. Each finished dive writes one.</p>';
    return;
  }
  list.innerHTML = pages.map(p =>
    `<button class="log-entry" data-log-id="${p.id}">` +
    `<span class="log-entry-date">${escapeHtml(formatLogDate(p.at))}</span>` +
    `<span class="log-entry-goal">${escapeHtml(p.goal !== '' ? p.goal : 'no goal written')}</span>` +
    `<span class="log-entry-meta"><span class="num">${p.depth.toLocaleString('en-US')}</span> m, ${escapeHtml(p.zone)}</span>` +
    `</button>`
  ).join('');
}

/** Debug: fill the Log tab with sample pages without touching storage. */
function sampleLogPages(): DiveLogPage[] {
  const base = sampleDiveLogPage();
  const day = 86_400_000;
  return [
    base,
    { ...base, id: 2, at: base.at - day, goal: 'Reply to every open email', depth: 620, zone: 'Twilight', chapter: 2, creatures: ['Moon Jellyfish'], distractions: 0, eyePeak: 0, sketchCardId: 'moon-jellyfish' },
    { ...base, id: 3, at: base.at - 2 * day, goal: '', depth: 310, zone: 'Sunlit', chapter: 1, creatures: [], distractions: 1, eyePeak: 1, sketchCardId: '' },
  ];
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
    appController.registerDistraction();
    
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
  // 00. Hand-drawn line work for the companion (static, once).
  applyInk(document);

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
  const urlParams = new URLSearchParams(window.location.search);
  const debugPanel = document.getElementById('debug-panel');
  const debugOn = urlParams.get('debug') === '1';
  if (debugOn) {
    debugPanel?.classList.remove('hidden');
  }
  initDebugControls();
  buildDepthTicks();
  // URL entry points for jumping straight to a depth/zone/ending.
  applyUrlOverrides(urlParams);
  // ?preview=1 auto-animates the whole descent in ~60 s.
  if (urlParams.get('preview') === '1') {
    debugPanel?.classList.remove('hidden');
    startPreview();
  }
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) {
      debugPanel?.classList.toggle('hidden');
    }
    if (e.key === 'Escape') {
      hideDiveLog();
      setCodexOpen(false);
      codexShowcaseLock = false;
      setDepthOverride(null);
    }
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

  // Codex drawer tabs: creatures / dive log.
  const setCodexTab = (tab: 'creatures' | 'log'): void => {
    const isLog = tab === 'log';
    document.getElementById('codex-display')?.toggleAttribute('hidden', isLog);
    document.getElementById('log-display')?.toggleAttribute('hidden', !isLog);
    const tc = document.getElementById('tab-creatures');
    const tl = document.getElementById('tab-log');
    tc?.setAttribute('aria-selected', String(!isLog));
    tl?.setAttribute('aria-selected', String(isLog));
    tc?.classList.toggle('faint', isLog);
    tl?.classList.toggle('faint', !isLog);
  };
  document.getElementById('tab-creatures')?.addEventListener('click', () => setCodexTab('creatures'));
  document.getElementById('tab-log')?.addEventListener('click', () => setCodexTab('log'));
  document.getElementById('log-display')?.addEventListener('click', (e) => {
    const entry = (e.target as HTMLElement).closest<HTMLElement>('[data-log-id]');
    if (!entry) return;
    const id = Number(entry.dataset['logId']);
    const pages = logShowcaseLock ? sampleLogPages() : appController.getState().diveLog;
    const page = pages.find(p => p.id === id);
    if (page) showDiveLog(page);
  });

  // Debug: ?debug=1&return=1 holds the ink in, then plays the return reaction.
  const playReturnDemo = (): void => {
    const scene = document.getElementById('app');
    scene?.classList.add('ink-demo');
    window.setTimeout(() => {
      scene?.classList.remove('ink-demo');
      playReturn();
    }, 1800);
  };
  document.getElementById('debug-return')?.addEventListener('click', playReturnDemo);
  if (debugOn && urlParams.get('return') === '1') window.setTimeout(playReturnDemo, 500);

  // Dive-log overlay buttons; a new page from a finished round waits for the card.
  document.getElementById('dive-log-close')?.addEventListener('click', hideDiveLog);
  document.getElementById('dive-log-save')?.addEventListener('click', () => { void saveDiveLogPage(); });
  appController.onDiveLogPage((page) => { pendingLogPage = page; });

  // Debug: ?debug=1&log=1 shows a sample page; ?log=tab fills the Log tab with samples.
  const showSampleLog = (): void => showDiveLog(sampleDiveLogPage());
  const showSampleLogTab = (): void => {
    logShowcaseLock = true;
    logKey = '';
    renderLogList(sampleLogPages());
    setCodexTab('log');
    setCodexOpen(true);
  };
  document.getElementById('debug-log')?.addEventListener('click', showSampleLog);
  const logParam = urlParams.get('log');
  if (debugOn && logParam === '1') window.setTimeout(showSampleLog, 400);
  if (debugOn && logParam === 'tab') window.setTimeout(showSampleLogTab, 400);

  // Debug codex showcase: open the drawer with a synthetic unlocked list,
  // via the debug buttons or ?codex=all / ?codex=mixed. Closing releases it.
  const releaseAndClose = (): void => {
    codexShowcaseLock = false;
    codexKey = '';
    setCodexOpen(false);
  };
  document.getElementById('codex-close')?.addEventListener('click', releaseAndClose);
  document.getElementById('codex-show-all')?.addEventListener('click', () => showcaseCodex('all', setCodexOpen));
  document.getElementById('codex-show-mixed')?.addEventListener('click', () => showcaseCodex('mixed', setCodexOpen));
  const codexParam = urlParams.get('codex');
  if (codexParam === 'all' || codexParam === 'mixed') {
    debugPanel?.classList.remove('hidden');
    showcaseCodex(codexParam, setCodexOpen);
  }
  // Debug-only hook: open a specific creature card by id, for screenshots.
  // isDuplicate=true shows it fully "inked in"; false runs the ink-in sweep.
  if (debugOn || codexParam) {
    (window as unknown as { __debugCard?: (id: string, dup?: boolean) => void }).__debugCard = (
      id: string,
      dup = false,
    ): void => showCardReveal(id, false, !dup ? false : true);
  }

  // Debug: replay the full unlock (ink-in, then colour wash) on a card without
  // touching game state. Button "Play unlock" cycles through the six cards;
  // ?debug=1&reveal=1 plays the first one on load, ?reveal=<card id> picks one.
  let unlockDemoIdx = 0;
  const playUnlock = (id?: string): void => {
    const card = (id ? CREATURE_CARDS.find(c => c.id === id) : undefined) ?? CREATURE_CARDS[unlockDemoIdx % CREATURE_CARDS.length];
    if (!card) return;
    if (!id) unlockDemoIdx += 1;
    showCardReveal(card.id, false);
  };
  document.getElementById('play-unlock')?.addEventListener('click', () => playUnlock());
  const revealParam = urlParams.get('reveal');
  if (debugOn && revealParam) {
    window.setTimeout(() => playUnlock(revealParam === '1' ? CREATURE_CARDS[0]?.id : revealParam), 400);
  }

  // Debug: escalating-eye level. ?eye=1|2|3 pins the level; the buttons set
  // it live. updateUI reads eyeLevelOverride each frame when it is non-null.
  const setEyeOverride = (level: number | null): void => {
    eyeLevelOverride = level;
    updateUI();
  };
  document.getElementById('debug-eye-1')?.addEventListener('click', () => setEyeOverride(1));
  document.getElementById('debug-eye-2')?.addEventListener('click', () => setEyeOverride(2));
  document.getElementById('debug-eye-3')?.addEventListener('click', () => setEyeOverride(3));
  const eyeParam = urlParams.get('eye');
  if (debugOn && eyeParam && ['1', '2', '3'].includes(eyeParam)) {
    setEyeOverride(parseInt(eyeParam, 10));
  }

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

  // Preselect 25 min so START DESCENT is live immediately and the choice
  // is visible. The owner reported that START did nothing until a duration
  // was picked, because START is disabled while selectedDuration is null.
  const selectDuration = (button: HTMLElement | null): void => {
    const durationStr = button?.getAttribute('data-duration');
    if (!button || !durationStr) return;
    selectedDuration = parseInt(durationStr, 10);
    durationButtons.forEach(btn => btn?.classList.remove('selected'));
    button.classList.add('selected');
    updateUI();
  };

  durationButtons.forEach(button => {
    button?.addEventListener('click', () => selectDuration(button));
  });

  // Default selection (only in IDLE, i.e. not mid-round after a reload).
  if (initialState.stateMachine.getState() === AppState.IDLE) {
    selectDuration(duration25);
  }
  
  // Focus goal slip: saved as you type (sanitized to 60 chars by the controller).
  const goalInputEl = document.getElementById('goal-input') as HTMLInputElement | null;
  goalInputEl?.addEventListener('input', () => appController.setFocusGoal(goalInputEl.value));
  goalInputEl?.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing must not trigger global shortcuts (Shift+D etc.)
    if (e.key === 'Enter') goalInputEl.blur();
  });

  // 3. 綁定 START DESCENT 按鈕
  const startButton = document.getElementById('start-button');
  const durationSelection = document.getElementById('duration-selection');
  startButton?.addEventListener('click', () => {
    if (selectedDuration === null) {
      // Nothing selected: give a gentle visual hint instead of doing nothing.
      durationSelection?.classList.remove('hint');
      void durationSelection?.offsetWidth; // restart the animation
      durationSelection?.classList.add('hint');
      return;
    }
    const success = appController.handleStartFocus(selectedDuration);
    if (success) {
      // 清除選擇
      selectedDuration = null;
      durationButtons.forEach(btn => btn?.classList.remove('selected'));
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
