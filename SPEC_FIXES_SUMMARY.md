# Focus-Core Spec 修正摘要

## ✅ 已完成的 7 項修正

### 1. Bug 修正：handleRoundComplete 順序
**問題**：在 commitRound 之前就用 depthState.totalDepth 判斷 reachedTarget，導致剛好潛到 10900m 的那一輪不會進 ENDING。

**修正**：
- 先呼叫 `depthCalculator.commitRound(depthState)` 更新深度
- 再用 commit 後的 `depthState.totalDepth` 判斷 `reachedTarget`
- 加入測試案例確保正確觸發 ENDING

**位置**：design.md 第 1000 行附近的 handleRoundComplete 函數

---

### 2. 結局只觸發一次
**問題**：每次完成一輪達到 10900m 都會進 ENDING。

**修正**：
- Config 無需新增（產品邏輯）
- StoredData 加入 `endingSeen: boolean`
- handleRoundComplete 改為 `shouldShowEnding = reachedTarget && !endingSeen`
- 第一次進 ENDING 時設定 `endingSeen = true`
- dive again 時重置 `endingSeen = false`
- 之後在 10900m 完成的輪照常進短/長休息、照常發卡（重複記錄）
- dive again 按鈕在 `endingSeen為 true` 時顯示（ENDING 狀態或 IDLE 狀態皆可）

**位置**：
- design.md 第 760 行：StoredData 介面
- design.md 第 1000 行：handleRoundComplete 邏輯
- requirements.md 第 235 行：UI 需求 12-13

---

### 3. DISTRACTED 不卡住
**問題**：這個 spec 沒有巨眼動畫，DISTRACTED 狀態可能無法自動結束。

**修正**：
- Config 加入 `distractedDurationSec: 3`（預設 3 秒）
- RAF Loop 加入 DISTRACTED 狀態處理：時間到自動發 `DISTRACTION_ANIMATION_COMPLETE` 回 FOCUSING
- DISTRACTED 期間不檢查完成（不會中途觸發 handleRoundComplete）
- 狀態轉換表加入 `DISTRACTED → ABANDON_ROUND → IDLE`（放棄功能）
- 測試分心按鈕走同一條路（進 DISTRACTED，3 秒後自動回 FOCUSING）

**位置**：
- design.md 第 108 行：Config.distractedDurationSec
- design.md 第 166 行：狀態轉換表
- design.md �� 950 行：RAF Loop

---

### 4. 關頁重開正確處理
**問題**：
- DISTRACTED 狀態重開沒有處理
- 深度計算不精確
- 用 transition 會觸發非法轉換錯誤

**修正**：
- FOCUSING 或 DISTRACTED 狀態重開都視為放棄
- 使用 `timer.getElapsedFocusedTime(timerState, lastSeenAt)` 計算專注時間
  - 自動扣掉分心時間
  - 自動扣掉關頁前的隱藏時段
  - 自動套用演示模式倍率
- 以選定時長為上限：`min(focusedTime, selectedDurationMs)`
- 上浮懲罰包含在 `timerState.distractionPenaltyMs` 中，已自動計算
- 直接設定 `stateMachine.currentState = AppState.IDLE`（不走 transition）

**位置**：design.md 第 850 行：restoreFromStorage 函數

---

### 5. 一輪的長度統一說明
**原設計**：剩餘時間 = 選定時長 − 專注時間（分心會讓這輪變長）

**修正**：
- design.md 已正確實作（無需改動）
- requirements.md 需求 4.2 改為一致說法：
  ```
  2. WHEN 查詢剩餘時間，THE Timer SHALL 回傳（選定時長 - 已專注時間），分心會延長一輪的實際時間
  ```

**位置**：requirements.md 第 82 行

---

### 6. 卡片資料照抄 codex.md
**問題**：design.md 中 CREATURE_CARDS 的 facts 用 "..." 佔位或不正確。

**修正**：逐字照抄 docs/codex.md，包含中英文名稱和出處：

- **Moon jellyfish**: "Mostly near the surface in coastal waters; recorded 0–1,250 m. Sources: SeaLifeBase; WoRMS"
- **Barreleye**: "600–800 m; transparent head, green tubular eyes. Sources: MBARI; Monterey Bay Aquarium"
- **Humpback anglerfish**: "Usually 100–1,500 m (most often 500–1,500 m); recorded to ~3,600 m. Sources: FishBase; Pietsch via Zenodo"
- **Dumbo octopus**: "1,000–7,000 m; deepest octopus ever filmed at 6,957 m (Java Trench, 2020). Sources: NHM London; Marine Biology 2020; Guinness"
- **Mariana snailfish**: "6,198–8,178 m, usually 7,000–8,000 m; no fish likely below ~8,400 m. Sources: FishBase; NOAA Ocean Exploration"
- **Supergiant amphipod**: "~6,800–11,000 m; dominant animal of Challenger Deep (collected at 10,929 m). Sources: Cell 2025; Mitochondrial DNA B 2016"

**位置**：design.md 第 560-620 行：CREATURE_CARDS 定義

---

### 7. 狀態表與 UI 修正
**修正項目**：
- 狀態轉換表加入 `ENDING → DIVE_AGAIN → IDLE`
- 狀態轉換表加入 `DISTRACTED → ABANDON_ROUND → IDLE`
- Demo Mode 切換不能時停用按鈕（設 `disabled` 屬性），移除 `alert()` 彈窗
- StateTransitionEvent 的 `ROUND_COMPLETE` 改為 `shouldShowEnding` 參數（更語義化）

**位置**：
- design.md 第 166 行：狀態轉換表
- design.md 第 136 行：StateTransitionEvent 型別
- design.md 第 910 行：Demo Mode 切換邏輯

---

## 📝 額外改進

### 測試覆蓋新增
在 Testing Strategy 章節加入以下測試案例：
- 測試 handleRoundComplete 在剛好達到 10900m 時正確進入 ENDING
- 測試 endingSeen 為 true 後再次完成一輪進入休息而非 ENDING
- 測試 DISTRACTED 3 秒後自動轉回 FOCUSING
- 測試 DISTRACTED 狀態下放棄功能
- 測試關頁重開時 DISTRACTED 狀態視為放棄
- 測試 dive again 功能正確重置 endingSeen 和 totalDepth

### Application Controller 新增變數
```typescript
let distractedStartAt: number = 0; // 記錄 DISTRACTED 狀態開始時間
let endingSeen: boolean = false;   // 是否已經看過 ENDING
```

---

## ✅ 格式驗證
- design.md: 通過
- requirements.md: 通過

## 📦 檔案狀態
- `.kiro/specs/focus-core/design.md` - 已修改
- `.kiro/specs/focus-core/requirements.md` - 已修改
- `.kiro/specs/focus-core/DESIGN_CHANGES.md` - 新增（詳細修改清單）
- `SPEC_FIXES_SUMMARY.md` - 新增（本檔案）

準備推送至 repo。
