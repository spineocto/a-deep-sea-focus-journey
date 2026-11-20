# Design.md 修正清單

已完成的修正：
- ✓ Config 加入 `distractedDurationSec: 3`
- ✓ Storage 加入 `endingSeen: boolean`
- ✓ 狀態轉換表加入 `DISTRACTED → ABANDON_ROUND → IDLE`
- ✓ 狀態轉換表加入 `ENDING → DIVE_AGAIN → IDLE`

待完成的修正：

## 1. 卡片資料完整替換（第 558-650 行）

將 CREATURE_CARDS 的 facts 欄位改為 codex.md 的完整內容：

```typescript
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
```

## 2. selectCardForRound 修正（第 660 行附近）

將參數和邏輯改為：

```typescript
function selectCardForRound(
  totalDepth: number,
  codexState: CodexState,
  shouldShowEnding: boolean  // 改名
): UnlockResult {
  // 特殊情況：第一次進入 ENDING 狀態
  if (shouldShowEnding) {
    const endingCard = CREATURE_CARDS.find(c => c.isEndingCard)!;
    return unlockCard(endingCard, codexState);
  }
  
  // 一般情況：從前 5 張卡片中選擇（包含已達 10900m 但 endingSeen=true 的情況）
  ...
}
```

## 3. handleRoundComplete 完整重寫（第 1000-1050 行）

```typescript
function handleRoundComplete(): void {
  // 1. 先完成深度計算（commitRound）
  depthState = depthCalculator.commitRound(depthState);
  
  // 2. 再用 commit 後的深度判斷是否達目標
  const reachedTarget = depthCalculator.hasReachedTarget(depthState.totalDepth);
  
  // 3. 判斷是否應該進入 ENDING（第一次到底）
  const shouldShowEnding = reachedTarget && !endingSeen;
  
  // 4. 計算是否長休息（只有非 ENDING 時才判斷）
  const isLongBreak = !shouldShowEnding && 
                      (completedRounds + 1) % Config.longBreakInterval === 0;
  
  // 5. 選擇卡片
  const unlockResult = codexManager.selectCardForRound(
    depthState.totalDepth,
    codexState,
    shouldShowEnding
  );
  
  // 6. 增加完成輪數
  completedRounds += 1;
  
  // 7. 如果進入 ENDING，設定 endingSeen
  if (shouldShowEnding) {
    endingSeen = true;
  }
  
  // 8. 顯示卡片（UI 邏輯）
  showCardReveal(unlockResult);
  
  // 9. 轉換狀態
  stateMachine.transition({
    type: 'ROUND_COMPLETE',
    shouldShowEnding,  // 改名
    isLongBreak: !shouldShowEnding && isLongBreak
  });
  
  // 10. 儲存
  storage.save(getCurrentData(), demoMode.isEnabled);
}
```

## 4. RAF Loop 加入 DISTRACTED 自動結束（第 980-1000 行）

```typescript
function rafLoop(): void {
  const nowMs = Date.now();
  const state = stateMachine.getState();
  
  if (state === AppState.FOCUSING) {
    // ... 現有邏輯
  } else if (state === AppState.DISTRACTED) {
    // DISTRACTED 狀態自動結束
    const distractedDuration = nowMs - distractedStartAt;
    if (distractedDuration >= Config.distractedDurationSec * 1000) {
      stateMachine.transition({ type: 'DISTRACTION_ANIMATION_COMPLETE' });
    }
    
    // 期間不檢查完成
    updateUI();
  } else if (state === AppState.SHORT_BREAK || state === AppState.LONG_BREAK) {
    // ... 休息邏輯
  }
  
  requestAnimationFrame(rafLoop);
}
```

需要在 Controller 中加入 `distractedStartAt` 變數：

```typescript
let distractedStartAt: number = 0;

// 當進入 DISTRACTED 時
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && event.triggered) {
    stateMachine.transition({ type: 'DISTRACTION_DETECTED' });
    distractedStartAt = Date.now();  // 記錄開始時間
  }
});
```

## 5. restoreFromStorage 修正（第 850-900 行）

```typescript
function restoreFromStorage(storage: Storage, isDemoMode: boolean): void {
  const data = storage.load(isDemoMode);
  if (!data) return;
  
  // 復原深度與圖鑑
  depthState.totalDepth = data.totalDepth;
  completedRounds = data.completedRounds;
  endingSeen = data.endingSeen;  // 新增
  codexState = data.codex;
  
  // 處理未完成狀態
  if (data.currentState.state === AppState.FOCUSING || 
      data.currentState.state === AppState.DISTRACTED) {  // 加入 DISTRACTED
    // 視為放棄：使用 getElapsedFocusedTime 計算保留深度
    const timerState: TimerState = {
      roundStartAt: data.currentState.roundStartAt!,
      selectedDurationMs: data.currentState.selectedDurationMs!,
      lastSeenAt: data.currentState.lastSeenAt || data.currentState.roundStartAt!,
      hiddenAt: data.currentState.hiddenAt,
      distractionPenaltyMs: data.currentState.distractionPenaltyMs,
      isDemoMode: isDemoMode
    };
    
    const lastSeenAt = timerState.lastSeenAt;
    const focusedTime = timer.getElapsedFocusedTime(timerState, lastSeenAt);
    const cappedTime = Math.min(focusedTime, timerState.selectedDurationMs);
    const descent = depthCalculator.calculateDescent(cappedTime);
    
    // 應用深度（包含上浮懲罰，已在 timerState.distractionPenaltyMs 中）
    depthState.roundDescentDepth = descent;
    depthState = depthCalculator.abandonRound(depthState);
    
    // 直接設定狀態為 IDLE（不走 transition，避免非法轉換）
    stateMachine.currentState = AppState.IDLE;
  } else if (
    data.currentState.state === AppState.SHORT_BREAK ||
    data.currentState.state === AppState.LONG_BREAK
  ) {
    // 視為休息完成
    stateMachine.currentState = AppState.IDLE;
  }
  // IDLE、ENDING 保持原狀
}
```

## 6. Demo Mode 切換移除 alert（第 910 行附近）

```typescript
function onDemoModeToggle(): void {
  if (!demoMode.canToggle(stateMachine.getState())) {
    // 移除 alert()，改為在 UI 中停用按鈕
    return;
  }
  
  // 儲存當前模式資料
  storage.save(getCurrentData(), demoMode.isEnabled);
  
  // 切換
  const newState = demoMode.toggle();
  
  // 載入新模式資料
  restoreFromStorage(storage, newState);
}
```

UI 按鈕改為：

```html
<button 
  onClick={onDemoModeToggle} 
  disabled={stateMachine.getState() !== AppState.IDLE}
  style={{ opacity: stateMachine.getState() !== AppState.IDLE ? 0.5 : 1 }}
>
  DEMO MODE {demoMode.isEnabled ? '(ON)' : '(OFF)'}
</button>
```

## 7. StateTransitionEvent 更新（第 136 行附近）

```typescript
export type StateTransitionEvent =
  | { type: 'START_FOCUS'; durationMinutes: number }
  | { type: 'DISTRACTION_DETECTED' }
  | { type: 'DISTRACTION_ANIMATION_COMPLETE' }
  | { type: 'ROUND_COMPLETE'; shouldShowEnding: boolean; isLongBreak: boolean }  // 改名
  | { type: 'BREAK_COMPLETE' }
  | { type: 'SKIP_BREAK' }
  | { type: 'ABANDON_ROUND' }
  | { type: 'ENDING_CONFIRMED' }
  | { type: 'DIVE_AGAIN' };
```

## 8. UI 需求 12 更新：dive again 按鈕顯示條件（第 1200 行附近）

```typescript
// 需求 12: 暫時 UI 顯示
12. WHEN 在 ENDING 狀態，THE System SHALL 顯示 "dive again" 按鈕
13. WHEN 在 IDLE 狀態且 endingSeen 為 true，THE System SHALL 顯示低調的 "dive again" 按鈕
```

UI 實作：

```typescript
{(state === AppState.ENDING || (state === AppState.IDLE && endingSeen)) && (
  <button onClick={onDiveAgain} className="dive-again-button">
    dive again
  </button>
)}
```

## 9. Requirements.md 同步修正

需求 4.2 改為：

```
2. WHEN 查詢剩餘時間，THE Timer SHALL 回傳（選定時長 - 已專注時間），分心會延長一輪的實際時間
```

## 10. 測試覆蓋新增

在 Testing Strategy 加入：

- 測試 handleRoundComplete 在剛好達到 10900m 時正確進入 ENDING
- 測試 endingSeen 為 true 後再次完成一輪進入休息而非 ENDING
- 測試 DISTRACTED 3 秒後自動轉回 FOCUSING
- 測試 DISTRACTED 狀態下放棄功能
- 測試關頁重開時 DISTRACTED 狀態視為放棄
- 測試 dive again 功能重置 endingSeen
