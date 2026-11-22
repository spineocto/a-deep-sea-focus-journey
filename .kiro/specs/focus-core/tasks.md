# Implementation Plan: focus-core

## Overview

本實作計畫將 focus-core 深海番茄鐘核心模組拆分為小而明確的實作步驟。每個任務專注於單一模組或功能，並在完成實作後立即進行測試，確保增量開發的穩定性。

實作策略：
- 從底層模組（Config、State Machine）開始向上建構
- 每個模組完成後立即撰寫單元測試與屬性測試
- 在整合階段建立 Application Controller 協調各模組
- 最後實作暫時 UI 以驗證完整流程

## Tasks

- [x] 1. 建立專案骨架與基礎設定
  - **重要：專案根目錄已有 .kiro、art、docs、public、README.md、LICENSE、.gitignore，建立 Vite 專案時絕對不可刪除或覆蓋這些檔案**
  - 如果工具詢問要不要清空資料夾，選擇「不要」
  - 可以手動建立 package.json、tsconfig.json、vite.config.ts、index.html、src/ 等新檔案
  - 使用 Vite 建立 TypeScript 專案
  - 設定 tsconfig.json 啟用嚴格模式
  - 安裝 Vitest 測試框架
  - 安裝 fast-check 屬性測試庫
  - 設定 package.json scripts（dev、build、test）
  - 建立基本目錄結構（src/、src/__tests__/）
  - 驗證開發伺服器可啟動
  - **確認 .kiro 目錄仍然存在且未被修改**
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 實作 Config 模組
  - 建立 `src/config.ts`
  - 定義 Zone 型別
  - 匯出所有設定常數（descentSpeedPerMinute、durationOptions、distractionThreshold 等）
  - 定義 zones 陣列（Sunlit、Twilight、Midnight、Abyssal、Hadal）
  - 確保所有參數使用 as const 確保型別安全
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13_

- [ ]* 2.1 撰寫 Config 模組單元測試
  - 建立 `src/__tests__/config.test.ts`
  - 測試所有預設值是否正確設定
  - 測試 zones 定義是否涵蓋所有深度範圍（0 到 Infinity）
  - 測試 zones 邊界值（0、200、1000、4000、6000）
  - _需求: 2.1-2.13_

- [x] 3. 實作 State Machine 模組
  - 建立 `src/state-machine.ts`
  - 定義 AppState 列舉（IDLE、FOCUSING、DISTRACTED、SHORT_BREAK、LONG_BREAK、ENDING）
  - 定義 StateTransitionEvent 型別（使用 discriminated union）
  - 定義 TransitionResult 介面
  - 實作 StateMachine 類別與 transition() 方法
  - 實作狀態轉換表邏輯（使用 switch 語句）
  - 實作 canTransition() 方法
  - 實作 getState() 方法
  - 確保非法轉換回傳 `{ success: false, error: '...' }`
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

- [x] 3.1 撰寫 State Machine 單元測試
  - 建立 `src/__tests__/state-machine.test.ts`
  - 測試所有合法狀態轉換（IDLE → FOCUSING、FOCUSING → DISTRACTED 等）
  - 測試所有非法狀態轉換回傳 false
  - 測試邊界情況（IDLE → IDLE、重複轉換）
  - 測試每個 event 類型的參數驗證
  - _需求: 3.2-3.13_

- [ ]* 3.2 撰寫 State Machine 屬性測試
  - 在 `src/__tests__/state-machine.test.ts` 新增屬性測試
  - **屬性 4: 狀態轉換合法性**
  - **驗證: 需求 3.13**
  - 使用 fast-check 生成隨機狀態與事件組合
  - 驗證 canTransition() 與 transition() 結果一致性
  - _需求: 3.12, 3.13_

- [x] 4. 實作 Timer 模組
  - 建立 `src/timer.ts`
  - 定義 TimerState 介面
  - 定義 Timer 介面
  - 實作 start() 方法（初始化 TimerState）
  - 實作 getElapsedFocusedTime() 方法（時間戳計算邏輯）
  - 實作 getRemainingTime() 方法
  - 實作 markHidden() 與 markVisible() 方法
  - 實作 applyDistractionPenalty() 方法
  - 實作 updateLastSeen() 方法
  - 實作 isComplete() 方法
  - 確保時間計算支援 Demo 模式倍率
  - 確保專注時間永遠非負（使用 Math.max(0, ...)）
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 4.1 撰寫 Timer 模組單元測試
  - 建立 `src/__tests__/timer.test.ts`
  - 測試時間戳計算準確性（正常模式）
  - 測試 Demo 模式時間加速（60 倍）
  - 測試分心懲罰扣除邏輯
  - 測試 lastSeenAt 更新機制
  - 測試隱藏時段時間排除
  - 測試邊界情況（nowMs < roundStartAt 回傳 0）
  - 測試完成檢查（剩餘時間 <= 0）
  - _需求: 4.1-4.7_

- [ ]* 4.2 撰寫 Timer 模組屬性測試
  - 在 `src/__tests__/timer.test.ts` 新增屬性測試
  - **屬性 1: 時間戳計算穩定性**
  - **驗證: 需求 4.2, 4.4**
  - 使用 fast-check 生成隨機時間戳對 (t1, t2) 且 t1 < t2
  - 驗證 elapsed time at t2 >= elapsed time at t1（無分心懲罰時）
  - **屬性 15: 專注時間非負**
  - **驗證: 需求 4.2**
  - 驗證任何 timer state 的 elapsed focused time >= 0
  - _需求: 4.2, 4.4_

- [x] 5. 實作 Depth Calculator 模組
  - 建立 `src/depth-calculator.ts`
  - 定義 DepthState 介面
  - 定義 DepthCalculator 介面
  - 實作 calculateDescent() 方法（專注時間 × 12 m/min）
  - 實作 updateRoundDescent() 方法
  - 實作 calculateRisePenalty() 方法（20% 單次）
  - 實作 applyRisePenalty() 方法（50% 上限）
  - 實作 commitRound() 方法（深度結算）
  - 實作 abandonRound() 方法（保留深度）
  - 實作 resetDepth() 方法（重新下潛）
  - 實作 getZone() 方法（Zone 判斷）
  - 實作 hasReachedTarget() 方法（檢查是否達 10900m）
  - 確保 totalDepth 不超過 targetDepth（使用 Math.min）
  - 確保 totalDepth 不低於 roundStartDepth
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 5.1 撰寫 Depth Calculator 單元測試
  - 建立 `src/__tests__/depth-calculator.test.ts`
  - 測試深度計算公式（12 m/min）
  - 測試上浮懲罰計算（20% 單次、50% 上限）
  - 測試深度下限保護（不低於 roundStartDepth）
  - 測試 Zone 判斷（所有 5 個 Zone）
  - 測試達到 10900m 時限制
  - 測試邊界情況（深度 0、10900m、負數時間）
  - 測試 commitRound() 與 abandonRound() 邏輯
  - 測試 resetDepth()（總深度歸零但保留其他資料）
  - _需求: 5.1-5.7_

- [ ]* 5.2 撰寫 Depth Calculator 屬性測試
  - 在 `src/__tests__/depth-calculator.test.ts` 新增屬性測試
  - **屬性 2: 深度單調性**
  - **驗證: 需求 5.4, 9.2**
  - 驗證 commitRound() 或 abandonRound() 後 totalDepth >= roundStartDepth
  - **屬性 3: Zone 判斷一致性**
  - **驗證: 需求 5.6**
  - 驗證 getZone(depth) 多次呼叫回傳相同結果
  - **屬性 5: 上浮懲罰上限**
  - **驗證: 需求 6.9**
  - 驗證累積 roundRisePenalty <= roundDescentDepth * 50%
  - _需求: 5.4, 5.6, 6.9, 9.2_

- [x] 6. 實作 Distraction Detector 模組
  - 建立 `src/distraction-detector.ts`
  - 定義 DistractionEvent 介面
  - 定義 DistractionDetector 介面
  - 實作 checkDistraction() 方法（5 秒閾值判斷）
  - 實作 calculateRisePenalty() 方法
  - 確保隱藏時長 <= 5000ms 時 triggered: false
  - 確保隱藏時長 > 5000ms 時 triggered: true
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 6.1 撰寫 Distraction Detector 單元測試
  - 建立 `src/__tests__/distraction-detector.test.ts`
  - 測試 5 秒閾值判斷（4999ms 不觸發、5001ms 觸發）
  - 測試邊界值（0ms、5000ms、5001ms）
  - 測試上浮懲罰計算（20%）
  - 測試 shouldExcludeTime 旗標邏輯
  - _需求: 6.4, 6.5, 6.8_

- [ ]* 6.2 撰寫 Distraction Detector 屬性測試
  - 在 `src/__tests__/distraction-detector.test.ts` 新增屬性測試
  - **屬性 6: 分心閾值判斷**
  - **驗證: 需求 6.5, 6.7**
  - 使用 fast-check 生成隨機隱藏時長
  - 驗證 hiddenDuration <= 5000ms 時 triggered: false 且 shouldExcludeTime: false
  - _需求: 6.5, 6.7_

- [x] 7. 實作 Codex Manager 模組
  - 建立 `src/codex-manager.ts`
  - 定義 CreatureCard 介面
  - 定義 UnlockedCard 介面
  - 定義 CodexState 介面
  - 定義 UnlockResult 介面
  - 定義 CREATURE_CARDS 陣列（6 張卡片資料）
  - 實作 selectCardForRound() 方法（最淺優先選擇邏輯）
  - 實作 unlockCard() 輔助函數
  - 實作 markDuplicate() 輔助函數
  - 實作 isUnlocked() 方法
  - 實作 getUnlockedCards() 方法
  - 實作 getCard() 方法
  - 確保 Supergiant amphipod 只在 shouldShowEnding 時解鎖
  - 確保一般卡片選擇時排除 isEndingCard: true 的卡片
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

- [x] 7.1 撰寫 Codex Manager 單元測試
  - 建立 `src/__tests__/codex-manager.test.ts`
  - 測試第一輪獲得 Moon jellyfish
  - 測試最淺優先選擇邏輯（跨多個 Zone）
  - 測試深度未達時不發卡（例如 totalDepth < 200m 時不發 Barreleye）
  - 測試所有已達 Zone 已解鎖時記錄重複
  - 測試 Supergiant amphipod 只在 shouldShowEnding: true 時解鎖
  - 測試邊界情況（深度 0、10900m、所有卡片已解鎖）
  - 測試 obtainedCount 正確累加
  - _需求: 8.3, 8.4, 8.5, 8.9, 8.10_

- [ ]* 7.2 撰寫 Codex Manager 屬性測試
  - 在 `src/__tests__/codex-manager.test.ts` 新增屬性測試
  - **屬性 7: 卡片選擇最淺優先**
  - **驗證: 需求 8.3**
  - 驗證選中的卡片 zone min <= 所有其他未解鎖卡片的 zone min
  - **屬性 8: 卡片深度限制**
  - **驗證: 需求 8.4**
  - 驗證選中的卡片（非終局卡）zone min <= totalDepth
  - **屬性 9: 終局卡專屬性**
  - **驗證: 需求 8.9, 8.10**
  - 驗證 Supergiant amphipod 只在 shouldShowEnding: true 時被選中
  - _需求: 8.3, 8.4, 8.9, 8.10_

- [x] 8. 實作 Storage 模組
  - 建立 `src/storage.ts`
  - 定義 StoredData 介面
  - 定義 UserSettings 介面
  - 定義 Storage 介面
  - 定義 STORAGE_KEY 與 DEMO_STORAGE_KEY 常數
  - 實作 save() 方法（JSON 序列化）
  - 實作 load() 方法（JSON 解析與版本檢查）
  - 實作 migrateData() 方法（未來資料遷移用）
  - 實作 clear() 方法
  - 實作 clearAll() 方法
  - 加入錯誤處理（localStorage 讀寫失敗時 console.error）
  - _需求: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.12, 10.13, 10.14_

- [x] 8.1 撰寫 Storage 模組單元測試
  - 建立 `src/__tests__/storage.test.ts`
  - 使用 mock localStorage（例如 vitest 的 vi.stubGlobal）
  - 測試儲存與載入往返
  - 測試 Demo 模式隔離（不同 key）
  - 測試清除資料（clear 與 clearAll）
  - 測試資料格式無效時回傳 null
  - 測試版本不符時嘗試遷移
  - 測試 localStorage 讀寫失敗時不拋出錯誤
  - _需求: 10.1-10.14_

- [ ]* 8.2 撰寫 Storage 模組屬性測試
  - 在 `src/__tests__/storage.test.ts` 新增屬性測試
  - **屬性 10: 儲存載入往返**
  - **驗證: 需求 14.6**
  - 使用 fast-check 生成隨機 StoredData
  - 驗證 save() 後 load() 回傳等價的資料
  - _需求: 14.6_

- [x] 9. 實作 Demo Mode 模組
  - 建立 `src/demo-mode.ts`
  - 定義 DemoMode 介面
  - 實作 DemoMode 類別
  - 實作 toggle() 方法
  - 實作 canToggle() 方法（只允許在 IDLE 狀態）
  - 實作 getTimeMultiplier() 方法（1 或 60）
  - 實作 getStorageKey() 方法（'' 或 'demo_'）
  - _需求: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ]* 9.1 撰寫 Demo Mode 單元測試
  - 建立 `src/__tests__/demo-mode.test.ts`
  - 測試切換只在 IDLE 狀態允許
  - 測試時間倍率回傳值（1 或 60）
  - 測試儲存 key 前綴（'' 或 'demo_'）
  - 測試初始狀態（disabled）
  - _需求: 11.1-11.7_

- [ ]* 9.2 撰寫 Demo Mode 屬性測試
  - 在 `src/__tests__/demo-mode.test.ts` 新增屬性測試
  - **屬性 11: Demo 模式隔離**
  - **驗證: 需求 11.8**
  - 模擬正常模式進度，切換到 demo 模式並修改進度，再切換回正常模式
  - 驗證正常模式進度未受影響
  - _需求: 11.8_

- [x] 10. Checkpoint - 確保所有模組測試通過
  - 執行 `npm run test` 確保所有單元測試與屬性測試通過
  - 檢查測試覆蓋率（目標: 核心模組 >= 90%）
  - 若有失敗測試，修正後再繼續

- [x] 11. 實作 Application Controller - 初始化與狀態管理
  - 建立 `src/app-controller.ts`
  - 定義 AppGlobalState 介面
  - 實作 AppController 類別
  - 實作 init() 方法（初始化所有模組）
  - 實作 restoreFromStorage() 方法（處理 FOCUSING/BREAK 狀態復原）
  - 實作 getCurrentData() 方法（打包當前狀態為 StoredData）
  - 實作 handleStartFocus() 方法（使用者開始專注）
  - 實作 handleAbandonRound() 方法（使用者放棄）
  - 實作 handleSkipBreak() 方法（使用者跳過休息）
  - 實作 handleDiveAgain() 方法（使用者重新下潛）
  - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.10, 10.11_

- [x] 12. 實作 Application Controller - Page Visibility API 整合
  - 在 `src/app-controller.ts` 新增 setupVisibilityListeners() 方法
  - 實作 visibilitychange 事件處理（document.hidden 判斷）
  - 分頁隱藏時呼叫 timer.markHidden() 並儲存
  - 分頁顯示時呼叫 timer.markVisible() 並判斷是否觸發分心
  - 實作 pagehide 事件處理（更新 lastSeenAt）
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.13, 4.6, 4.7_

- [x] 13. 實作 Application Controller - RAF Loop
  - 在 `src/app-controller.ts` 新增 rafLoop() 方法
  - FOCUSING 狀態：更新計時、深度、檢查完成、定期更新 lastSeenAt
  - DISTRACTED 狀態：倒數 3 秒後自動轉換回 FOCUSING
  - SHORT_BREAK/LONG_BREAK 狀態：倒數休息時間、檢查完成
  - 呼叫 updateUI() 更新介面
  - 使用 requestAnimationFrame 循環
  - _需求: 4.4, 7.1, 7.2, 7.4_

- [x] 14. 實作 Application Controller - 完成一輪邏輯
  - 在 `src/app-controller.ts` 新增 handleRoundComplete() 方法
  - 先呼叫 depthCalculator.commitRound() 完成深度結算
  - 用結算後的 totalDepth 判斷 reachedTarget
  - 判斷 shouldShowEnding（reachedTarget && !endingSeen）
  - 判斷 isLongBreak（非 ENDING 且 (completedRounds + 1) % 4 === 0）
  - 呼叫 codexManager.selectCardForRound() 選擇卡片
  - 增加 completedRounds
  - 若 shouldShowEnding 設定 endingSeen = true
  - 轉換狀態（ROUND_COMPLETE 事件）
  - 儲存進度
  - _需求: 3.5, 3.6, 3.7, 7.5, 7.6, 8.3, 9.8, 9.9, 9.10, 9.11_

- [x] 14.1 撰寫 Application Controller 單元測試
  - 建立 `src/__tests__/app-controller.test.ts`
  - 測試初始化流程
  - 測試 restoreFromStorage() 處理 FOCUSING 狀態（視為放棄）
  - 測試 restoreFromStorage() 處理 BREAK 狀態（視為完成）
  - 測試開始專注流程
  - 測試放棄流程（深度保留、不發卡、不計入輪數）
  - 測試完成一輪流程（深度結算、發卡、進入休息）
  - 測試達到 10900m 進入 ENDING
  - 測試重新下潛（深度歸零、Codex 保留）
  - 測試 endingSeen 只在第一次達到 10900m 時進入 ENDING
  - 測試 endingSeen 為 true 後再次完成一輪進入休息而非 ENDING
  - 測試 DISTRACTED 狀態 3 秒後自動轉回 FOCUSING
  - 測試 DISTRACTED 狀態時可以點擊放棄
  - 測試重開時 DISTRACTED 狀態視為放棄
  - _需求: 9.2, 9.3, 9.4, 9.5, 9.6, 9.10, 9.11, 9.13, 9.14, 9.15_

- [x] 14.2 撰寫 Application Controller 整合測試
  - 在 `src/__tests__/app-controller.test.ts` 新增整合測試
  - 測試完整一輪流程（開始 → 完成 → 獲得卡片 → 休息 → IDLE）
  - 測試分心流程（開始 → 隱藏 → 顯示 → DISTRACTED → 繼續）
  - 測試長休息輪次（完成第 4、8、12 輪進入 LONG_BREAK）
  - 測試關頁重開（FOCUSING → 關閉 → 重開 → IDLE，深度保留）
  - 測試達到 10900m 完整流程（ENDING → dive again → 重新開始）
  - _需求: 6.14, 7.5, 9.5, 9.6, 9.8, 9.9_

- [ ]* 14.3 撰寫 Application Controller 屬性測試
  - 在 `src/__tests__/app-controller.test.ts` 新增屬性測試
  - **屬性 12: 重新下潛保留**
  - **驗證: 需求 9.16, 9.17**
  - 驗證 dive again 後 codex 與 completedRounds 保持不變
  - **屬性 13: lastSeenAt 深度上限**
  - **驗證: 需求 9.6**
  - 驗證重開後保留深度 <= selectedDuration 計算的深度
  - **屬性 14: 長休息輪次**
  - **驗證: 需求 7.5, 9.8**
  - 驗證 (completedRounds + 1) % 4 === 0 時進入 LONG_BREAK
  - _需求: 7.5, 9.6, 9.8, 9.16, 9.17_

- [x] 15. 實作暫時 UI - HTML 結構
  - 建立 `index.html`
  - 建立基本 HTML 結構（容器 div）
  - 顯示當前狀態名稱（#state-display）
  - 顯示剩餘時間（#time-display，分:秒格式）
  - 顯示 Total Depth（#total-depth-display，整數 + m）
  - 顯示 Descent Depth（#descent-depth-display，整數 + m）
  - 顯示當前 Zone（#zone-display）
  - 顯示 Completed Rounds（#rounds-display）
  - 顯示已解鎖卡片清單（#codex-display）
  - _需求: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 16. 實作暫時 UI - 控制按鈕
  - 在 `index.html` 新增時長選項按鈕（15/25/45 分鐘）
  - 新增 START DESCENT 按鈕（IDLE 狀態顯示）
  - 新增放棄按鈕（FOCUSING 狀態顯示）
  - 新增跳過按鈕（SHORT_BREAK/LONG_BREAK 狀態顯示）
  - 新增 "dive again" 按鈕（ENDING 狀態顯示）
  - 新增低調的 "dive again" 按鈕（IDLE 狀態且 endingSeen 為 true 時顯示）
  - 新增「測試分心」按鈕（手動觸發分心事件）
  - 新增 Demo Mode 切換開關（只在 IDLE 狀態可用）
  - 新增清除資料按鈕（需二次確認）
  - _需求: 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.14, 12.15, 12.16_

- [x] 17. 實作暫時 UI - 事件綁定與狀態更新
  - 建立 `src/main.ts` 作為入口
  - 初始化 AppController
  - 綁定所有按鈕事件（addEventListener）
  - 實作 updateUI() 函數（更新所有顯示元素）
  - 實作按鈕狀態切換（根據當前狀態顯示/隱藏按鈕）
  - 實作時長選擇高亮顯示
  - 實作卡片揭露動畫（簡單淡入效果）
  - 實作 Demo Mode 指示器（明確標示目前模式）
  - 啟動 RAF Loop
  - _需求: 11.7, 12.1-12.16_

- [x] 18. 實作暫時 UI - 手動分心測試功能
  - 在 `src/app-controller.ts` 新增 triggerManualDistraction() 方法
  - 計算當前下沉深度
  - 計算 20% 上浮懲罰
  - 呼叫 depthCalculator.applyRisePenalty()
  - 轉換到 DISTRACTED 狀態
  - 在 UI 綁定「測試分心」按鈕到此方法
  - _需求: 6.13, 12.14_

- [x] 19. Checkpoint - 手動測試基本流程
  - 啟動開發伺服器（`npm run dev`）
  - 測試完整一輪流程（15 分鐘選項、開始、等待完成、獲得卡片、休息）
  - 測試放棄流程（開始後放棄，確認深度保留）
  - 測試「測試分心」按鈕（確認上浮懲罰與 DISTRACTED 動畫）
  - 測試 Demo Mode（切換後時間加速 60 倍）
  - 測試清除資料功能
  - 若發現問題，修正後再繼續

- [x] 20. 撰寫完整情境整合測試
  - 建立 `src/__tests__/integration.test.ts`
  - **測試情境 1: 完整一輪無分心**
    - 開始專注 → 完成 → 獲得 Moon jellyfish → 進入 SHORT_BREAK → 完成休息 → IDLE
  - **測試情境 2: 一輪中有分心**
    - 開始專注 → 隱藏 10 秒 → 顯示 → DISTRACTED → 繼續 → 完成（深度減少）
  - **測試情境 3: 放棄一輪**
    - 開始專注 → 專注 5 分鐘 → 放棄 → 深度保留 → 不發卡 → IDLE
  - **測試情境 4: 長休息輪次**
    - 完成 3 輪 SHORT_BREAK → 完成第 4 輪 → LONG_BREAK
  - **測試情境 5: 達到 10900m**
    - 累積深度達 10900m → 完成一輪 → ENDING → 獲得 Supergiant amphipod
  - **測試情境 6: 重新下潛**
    - ENDING 狀態 → dive again → 深度歸零 → Codex 保留 → completedRounds 保留
  - **測試情境 7: 關頁重開（FOCUSING）**
    - 開始專注 5 分鐘 → 關閉（模擬） → 重開 → IDLE → 深度保留至 lastSeenAt
  - **測試情境 8: 關頁重開（BREAK）**
    - 進入 SHORT_BREAK → 關閉 → 重開 → IDLE
  - _需求: 6.14, 9.5, 9.6, 9.7, 9.8, 9.9, 10.10, 10.11_

- [x] 21. 優化與重構
  - 檢查程式碼重複（DRY 原則）
  - 確認所有魔術數字已移至 Config
  - 檢查型別定義完整性（避免 any）
  - 統一錯誤處理方式
  - 加入必要的程式碼註解（特別是複雜邏輯）
  - 確認所有 console.error/warn 適當使用

- [ ] 22. 撰寫專案 README
  - 建立 `README.md`
  - 說明專案目的與功能
  - 列出安裝步驟（`npm install`）
  - 列出開發指令（`npm run dev`, `npm run build`, `npm run test`）
  - 說明專案結構（模組說明）
  - 說明 Demo Mode 用途
  - 說明如何手動測試分心功能
  - 列出已知限制（暫時 UI、缺少美術等）

- [ ] 23. 執行完整測試套件與覆蓋率檢查
  - 執行 `npm run test` 確保所有測試通過
  - 執行 `npm run test:coverage` 檢查覆蓋率
  - 確認核心模組覆蓋率 >= 90%
  - 確認整體專案覆蓋率 >= 80%
  - 若覆蓋率不足，補充測試案例

- [ ] 24. Final Checkpoint - 完整驗收
  - 確認所有需求的驗收標準已實作
  - 手動測試所有功能（包括邊界情況）
  - 確認 Demo Mode 正常運作且隔離
  - 確認 localStorage 持久化正常
  - 確認關頁重開邏輯正確
  - 確認所有測試通過
  - 準備交付

## Notes

- **測試標記**：所有標記 `*` 的測試任務為選用，但強烈建議完成以確保程式碼品質
- **屬性測試**：使用 fast-check 進行屬性測試，最少 100 次迭代
- **增量開發**：每個模組完成實作後立即撰寫測試，確保早期發現錯誤
- **Checkpoint 任務**：在關鍵里程碑設置 checkpoint，確保進度穩定再繼續
- **Demo Mode**：時間加速 60 倍，使用獨立 localStorage key，不影響正常進度
- **暫時 UI**：簡單功能性 UI，不包含美術與動畫，僅用於測試核心邏輯
- **手動測試**：分心偵測與關頁重開需手動測試，因依賴瀏覽器行為
- **需求追溯**：每個任務明確標註對應的需求編號，確保完整覆蓋

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "2.1"] },
    { "id": 2, "tasks": ["3", "3.1", "3.2"] },
    { "id": 3, "tasks": ["4", "4.1", "4.2"] },
    { "id": 4, "tasks": ["5", "5.1", "5.2"] },
    { "id": 5, "tasks": ["6", "6.1", "6.2"] },
    { "id": 6, "tasks": ["7", "7.1", "7.2"] },
    { "id": 7, "tasks": ["8", "8.1", "8.2"] },
    { "id": 8, "tasks": ["9", "9.1", "9.2"] },
    { "id": 9, "tasks": ["10"] },
    { "id": 10, "tasks": ["11"] },
    { "id": 11, "tasks": ["12"] },
    { "id": 12, "tasks": ["13"] },
    { "id": 13, "tasks": ["14", "14.1", "14.2", "14.3"] },
    { "id": 14, "tasks": ["15"] },
    { "id": 15, "tasks": ["16"] },
    { "id": 16, "tasks": ["17"] },
    { "id": 17, "tasks": ["18"] },
    { "id": 18, "tasks": ["19"] },
    { "id": 19, "tasks": ["20"] },
    { "id": 20, "tasks": ["21"] },
    { "id": 21, "tasks": ["22"] },
    { "id": 22, "tasks": ["23"] },
    { "id": 23, "tasks": ["24"] }
  ]
}
```
