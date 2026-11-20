# Requirements Document

## Introduction

focus-core 是深海番茄鐘 web app 的核心計時與狀態管理模組。此模組實作專注計時、深度追蹤、分心懲罰、圖鑑解鎖邏輯與狀態持久化，但不包含視覺美術與動畫。目標是建立一個可測試、時間戳驅動、狀態明確的計時核心，為後續美術整合打好基礎。

## Glossary

- **System**: 整個 focus-core 系統
- **Timer**: 計時器模組，負責追蹤專注時間與剩餘時間
- **State_Machine**: 狀態機，管理 IDLE、FOCUSING、DISTRACTED、SHORT_BREAK、LONG_BREAK、ENDING 等狀態
- **Depth_Calculator**: 深度計算器，根據專注時間計算潛水球深度
- **Codex**: 圖鑑系統，記錄已解鎖的深海生物卡片
- **Storage**: localStorage 持久化模組
- **Config**: 集中設定檔，包含所有可調整參數
- **Demo_Mode**: 演示模式，時間加速 60 倍且不影響真實進度
- **Page_Visibility_API**: 瀏覽器 API，偵測分頁是否被隱藏
- **Distraction_Event**: 分心事件，當使用者返回分頁且發現隱藏超過 5 秒時觸發
- **Round**: 一輪專注，完成後可獲得一張生物卡片
- **Completed_Rounds**: 已完成輪數，只計算完成的輪，放棄的輪不計入
- **Zone**: 深度區間（Sunlit、Twilight、Midnight、Abyssal、Hadal）
- **Focused_Time**: 實際專注時間（排除分心時段）
- **Descent_Depth**: 本輪下沉深度
- **Total_Depth**: 累積總深度（跨 session 保留）
- **hiddenAt**: 分頁隱藏時記錄的時間戳
- **lastSeenAt**: 專注中最後一次確認使用者在線的時間戳

## Requirements

### 需求 1：專案骨架建立

**使用者故事：** 身為開發者，我想要建立 Vite + TypeScript 專案骨架，讓我能快速開始開發並執行開發伺服器。

#### 驗收標準

1. THE System SHALL 使用 Vite + TypeScript 建立專案
2. THE System SHALL 包含 package.json 且定義 dev、build、test 腳本
3. WHEN 執行 `npm install` 後執行 `npm run dev`，THE System SHALL 啟動開發伺服器並可在瀏覽器存取
4. THE System SHALL 使用 Vitest 作為測試框架
5. THE System SHALL 在專案根目錄包含 tsconfig.json 並啟用嚴格型別檢查

### 需求 2：集中設定檔

**使用者故事：** 身為開發者，我想要將所有可調整參數集中在一個設定檔，讓我能輕鬆調整遊戲參數而不需修改多個檔案。

#### 驗收標準

1. THE System SHALL 建立 Config 模組並匯出所有預設參數
2. THE Config SHALL 包含 descentSpeedPerMinute（預設值 12 公尺/分鐘）
3. THE Config SHALL 包含 distractionRisePercentage（預設值 20%）
4. THE Config SHALL 包含 maxDistractionRisePercentage（預設值 50%）
5. THE Config SHALL 包含 shortBreakDuration（預設值 5 分鐘）
6. THE Config SHALL 包含 longBreakDuration（預設值 15 分鐘）
7. THE Config SHALL 包含 longBreakInterval（預設值每 4 輪）
8. THE Config SHALL 包含 targetDepth（預設值 10900 公尺）
9. THE Config SHALL 包含 durationOptions（預設值 [15, 25, 45] 分鐘）
10. THE Config SHALL 包含 distractionThreshold（預設值 5 秒）
11. THE Config SHALL 包含 demoModeMultiplier（預設值 60 倍）
12. THE Config SHALL 包含 autoSaveInterval（預設值 5 秒）
13. THE Config SHALL 包含 zones 定義（Sunlit 0-200m、Twilight 200-1000m、Midnight 1000-4000m、Abyssal 4000-6000m、Hadal 6000m+）

### 需求 3：狀態機實作

**使用者故事：** 身為開發者，我想要用明確的狀態機管理應用程式狀態，讓我能避免零散布林值帶來的複雜度與錯誤。

#### 驗收標準

1. THE State_Machine SHALL 定義 IDLE、FOCUSING、DISTRACTED、SHORT_BREAK、LONG_BREAK、ENDING 等狀態
2. WHEN 在 IDLE 狀態且使用者選擇時長並點擊 START DESCENT，THE State_Machine SHALL 轉換到 FOCUSING 狀態
3. WHEN 在 FOCUSING 狀態且使用者返回分頁時發現隱藏超過 distractionThreshold（5 秒），THE State_Machine SHALL 轉換到 DISTRACTED 狀態
4. WHEN 在 DISTRACTED 狀態且經過 distractedDurationSec（3 秒），THE State_Machine SHALL 自動轉換回 FOCUSING 狀態
5. WHEN 在 FOCUSING 狀態且完成一輪（Total_Depth 未達 10900m 且非第 4、8、12... 輪），THE State_Machine SHALL 轉換到 SHORT_BREAK 狀態
6. WHEN 在 FOCUSING 狀態且完成一輪（Total_Depth 未達 10900m 且為第 4、8、12... 輪），THE State_Machine SHALL 轉換到 LONG_BREAK 狀態
7. WHEN 在 FOCUSING 狀態且完成一輪且 Total_Depth 已達 10900m，THE State_Machine SHALL 轉換到 ENDING 狀態（取代休息）
8. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態且休息完成或使用者跳過，THE State_Machine SHALL 轉換到 IDLE 狀態
9. WHEN 在 ENDING 狀態且使用者確認，THE State_Machine SHALL 轉換到 IDLE 狀態
10. WHEN 在 FOCUSING 狀態且使用者點擊放棄，THE State_Machine SHALL 轉換到 IDLE 狀態
11. WHEN 在 DISTRACTED 狀態且使用者點擊放棄，THE State_Machine SHALL 轉換到 IDLE 狀態
12. THE State_Machine SHALL 記錄當前狀態並允許查詢
13. THE State_Machine SHALL 拒絕非法狀態轉換

### 需求 4：計時器與時間戳追蹤

**使用者故事：** 身為使用者，我想要系統使用時間戳計算時間與深度，讓我切換分頁或系統節流時計時仍然準確。

#### 驗收標準

1. WHEN 使用者開始一輪專注，THE Timer SHALL 記錄開始時間戳（roundStartAt）
2. WHEN 查詢剩餘時間，THE Timer SHALL 回傳（選定時長 − 已專注時間），分心會延長這一輪的實際時間
3. WHEN Demo_Mode 啟用，THE Timer SHALL 將時間流逝速度乘以 60
4. THE Timer SHALL 在每次 tick（例如 requestAnimationFrame）時重新計算而非累加
5. WHEN 一輪完成，THE Timer SHALL 回傳該輪的 Focused_Time
6. WHEN 在 FOCUSING 狀態，THE Timer SHALL 每 5 秒更新 lastSeenAt 時間戳
7. WHEN 在 FOCUSING 狀態且觸發 pagehide 事件，THE Timer SHALL 更新 lastSeenAt 時間戳

### 需求 5：深度計算

**使用者故事：** 身為使用者，我想要專注時間轉換成潛水球深度，讓我能看到自己的進展並朝 10,900m 目標前進。

#### 驗收標準

1. WHEN 查詢 Descent_Depth，THE Depth_Calculator SHALL 用 Focused_Time（分鐘）乘以 descentSpeedPerMinute
2. WHEN 查詢 Total_Depth，THE Depth_Calculator SHALL 回傳累積深度（包含先前 session）
3. WHEN 一輪完成，THE Depth_Calculator SHALL 將 Descent_Depth 加入 Total_Depth
4. WHEN 使用者放棄一輪，THE Depth_Calculator SHALL 將目前 Descent_Depth 加入 Total_Depth
5. WHEN Total_Depth 達到或超過 targetDepth（10900m），THE Depth_Calculator SHALL 將 Total_Depth 限制在 targetDepth
6. WHEN 查詢當前 Zone，THE Depth_Calculator SHALL 根據 Total_Depth 回傳對應 Zone 名稱
7. THE Depth_Calculator SHALL 提供依據 Total_Depth 的 Zone 轉換檢查

### 需求 6：分心事件偵測與懲罰

**使用者故事：** 身為使用者，我想要系統偵測我是否切換分頁並計算懲罰，讓分心有實際後果但不會過度嚴厲。

#### 驗收標準

1. THE System SHALL 使用 Page_Visibility_API 偵測分頁隱藏與顯示
2. WHEN 在 FOCUSING 狀態且分頁隱藏，THE System SHALL 記錄 hiddenAt 時間戳
3. WHEN 在 FOCUSING 狀態且分頁從隱藏變為顯示，THE System SHALL 計算隱藏時長（當前時間 - hiddenAt）
4. WHEN 隱藏時長超過 distractionThreshold（5 秒），THE System SHALL 觸發一次 Distraction_Event 並轉換到 DISTRACTED 狀態
5. WHEN 隱藏時長未超過 distractionThreshold（5 秒），THE System SHALL 不觸發 Distraction_Event 且繼續 FOCUSING
6. WHEN 隱藏時長超過 distractionThreshold，THE System SHALL 將整段隱藏時間（從 hiddenAt 開始）排除在 Focused_Time 之外
7. WHEN 隱藏時長未超過 distractionThreshold，THE System SHALL 將隱藏時間計入 Focused_Time
8. WHEN 觸發 Distraction_Event，THE System SHALL 計算上浮深度為當下本輪已下沉深度（Descent_Depth）的 distractionRisePercentage（20%）
9. WHEN 本輪累積上浮深度超過本輪原始下沉深度的 maxDistractionRisePercentage（50%），THE System SHALL 將上浮深度限制在該上限
10. WHEN 計算上浮懲罰，THE Depth_Calculator SHALL 從 Descent_Depth 減去上浮深度
11. THE System SHALL 確保 Total_Depth 永遠不會低於本輪開始時的深度
12. THE System SHALL 記錄本輪 Distraction_Event 次數
13. THE System SHALL 提供手動觸發 Distraction_Event 的測試方法
14. WHEN 使用者返回分頁時本輪時間已到，THE System SHALL 先計算分心懲罰再結算該輪

### 需求 7：休息計時

**使用者故事：** 身為使用者，我想要完成專注後進入休息階段，並能選擇等待或跳過休息。

#### 驗收標準

1. WHEN 進入 SHORT_BREAK 狀態，THE Timer SHALL 啟動 shortBreakDuration（5 分鐘）倒數
2. WHEN 進入 LONG_BREAK 狀態，THE Timer SHALL 啟動 longBreakDuration（15 分鐘）倒數
3. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態且使用者點擊跳過，THE System SHALL 立即完成休息並轉換到 IDLE
4. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態且倒數結束，THE System SHALL 自動轉換到 IDLE
5. THE System SHALL 根據 Completed_Rounds 判斷下一個休息是 SHORT_BREAK 或 LONG_BREAK（每 4 輪為 LONG_BREAK）
6. WHEN 計算是否為長休息，THE System SHALL 只計算已完成的輪數，放棄的輪不計入

### 需求 8：圖鑑解鎖邏輯

**使用者故事：** 身為使用者，我想要完成專注輪後獲得深海生物卡片，讓我有收集動機並了解真實深海生物。

#### 驗收標準

1. THE Codex SHALL 儲存 6 張卡片定義（Moon jellyfish、Barreleye、Humpback anglerfish、Dumbo octopus、Mariana snailfish、Supergiant amphipod）
2. THE Codex SHALL 為每張卡片定義 zone、scientificName、depthRange、英文與中文名稱
3. WHEN 一輪完成且獲得卡片，THE Codex SHALL 選擇「尚未解鎖的最淺 Zone」的卡片
4. WHEN 選擇卡片時 Total_Depth 未達該 Zone，THE Codex SHALL 不發該卡並尋找更淺的卡片
5. WHEN 所有已達 Zone 的卡片都已解鎖，THE Codex SHALL 記錄一筆重複獲得紀錄
6. THE Codex SHALL 記錄每張卡片的解鎖時間戳與獲得次數
7. THE Codex SHALL 提供查詢已解鎖卡片清單的方法
8. THE Codex SHALL 提供查詢特定卡片是否已解鎖的方法
9. WHEN 一輪完成且進入 ENDING 狀態，THE System SHALL 自動解鎖 Supergiant amphipod 卡片（若尚未解鎖）
10. THE Codex SHALL 確保平常完成一輪時只從前 5 個海域的卡片（Moon jellyfish、Barreleye、Humpback anglerfish、Dumbo octopus、Mariana snailfish）中選擇，Supergiant amphipod 只在進入 ENDING 時解鎖

### 需求 9：遊戲機制規則

**使用者故事：** 身為使用者，我想要系統遵循明確的遊戲規則，讓行為可預測且公平。

#### 驗收標準

1. THE System SHALL 不提供暫停功能
2. WHEN 使用者在 FOCUSING 狀態點擊放棄，THE System SHALL 保留已獲得的 Descent_Depth 並加入 Total_Depth
3. WHEN 使用者在 FOCUSING 狀態點擊放棄，THE System SHALL 不發放卡片
4. WHEN 使用者在 FOCUSING 狀態點擊放棄，THE System SHALL 不將該輪計入 Completed_Rounds
5. WHEN 應用程式重新開啟且上次為 FOCUSING 狀態，THE System SHALL 視為放棄（深度保留至 lastSeenAt 但不超過該輪時長）
6. WHEN 應用程式重新開啟且上次為 FOCUSING 狀態，THE System SHALL 計算專注時間為 min(lastSeenAt - roundStartAt, 選定時長)
7. WHEN 使用者在 SHORT_BREAK 或 LONG_BREAK 狀態關閉頁面，THE System SHALL 在下次開啟時視為休息完成
8. WHEN 使用者完成第 4、8、12... 輪（根據 Completed_Rounds），THE System SHALL 進入 LONG_BREAK 而非 SHORT_BREAK
9. WHEN 一輪完成且 Total_Depth 已達到 10900m，THE System SHALL 進入 ENDING 狀態（取代 SHORT_BREAK 或 LONG_BREAK）
12. WHEN 第一次進入 ENDING 狀態，THE System SHALL 設定 endingSeen 為 true
13. WHEN endingSeen 為 true 且再次完成一輪達到 10900m，THE System SHALL 進入 SHORT_BREAK 或 LONG_BREAK 而非 ENDING
12. WHEN 使用者放棄一輪且 Total_Depth 已達到 10900m，THE System SHALL 不進入 ENDING，下一輪完成時才進入 ENDING
13. WHEN 在 ENDING 狀態，THE System SHALL 保持 Total_Depth 在 10900m
14. WHEN 在 ENDING 狀態後開始新輪，THE System SHALL 允許繼續計時但 Total_Depth 保持在底部
15. WHEN 在 ENDING 狀態且使用者選擇 "dive again"，THE System SHALL 將 Total_Depth 重置為 0
16. WHEN 選擇 "dive again"，THE System SHALL 保留 Codex 解鎖紀錄
17. WHEN 選擇 "dive again"，THE System SHALL 保留 Completed_Rounds

### 需求 10：本地儲存持久化

**使用者故事：** 身為使用者，我想要關閉瀏覽器後重新開啟時保留進度，讓我的累積深度與圖鑑不會遺失。

#### 驗收標準

1. THE Storage SHALL 將 Total_Depth 存入 localStorage
2. THE Storage SHALL 將 Completed_Rounds 存入 localStorage
3. THE Storage SHALL 將 Codex 解鎖紀錄存入 localStorage
4. THE Storage SHALL 將使用者設定存入 localStorage
5. THE Storage SHALL 將當前狀態（state、roundStartAt、lastSeenAt、hiddenAt）存入 localStorage
6. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入 Total_Depth
7. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入 Completed_Rounds
8. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入 Codex 解鎖紀錄
9. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入使用者設定
10. WHEN 應用程式啟動時有未完成的 FOCUSING 狀態，THE System SHALL 轉換到 IDLE 並根據 lastSeenAt 計算保留深度
11. WHEN 應用程式啟動時有未完成的 SHORT_BREAK 或 LONG_BREAK 狀態，THE System SHALL 轉換到 IDLE
12. THE Storage SHALL 在 FOCUSING 狀態每 5 秒和 pagehide 事件時自動儲存
13. THE Storage SHALL 在狀態轉換時自動儲存
14. THE Storage SHALL 提供清除所有資料的方法（用於重置或測試）

### 需求 11：演示模式

**使用者故事：** 身為開發者或展示者，我想要啟用加速演示模式，讓我能快速展示完整遊戲流程而不影響真實進度。

#### 驗收標準

1. THE System SHALL 提供啟用/停用 Demo_Mode 的切換開關
2. THE System SHALL 只允許在 IDLE 狀態切換 Demo_Mode
3. WHEN Demo_Mode 啟用，THE Timer SHALL 將時間流逝速度乘以 demoModeMultiplier（60）
4. WHEN Demo_Mode 啟用，THE Storage SHALL 使用獨立的 localStorage key（例如 demo_ 前綴）
5. WHEN Demo_Mode 停用，THE Storage SHALL 使用正常的 localStorage key
6. WHEN 切換 Demo_Mode，THE System SHALL 重新載入對應的儲存資料
7. THE System SHALL 在 UI 明確顯示目前是否為 Demo_Mode
8. WHEN Demo_Mode 啟用時的進度，THE System SHALL 不影響正常模式的進度

### 需求 12：暫時 UI 顯示

**使用者故事：** 身為開發者，我想要簡單的暫時 UI 顯示核心資訊與控制，讓我能測試所有功能而無需等待美術完成。

#### 驗收標準

1. THE System SHALL 顯示當前狀態名稱（IDLE、FOCUSING、DISTRACTED 等）
2. THE System SHALL 顯示剩餘時間（分:秒格式）
3. THE System SHALL 顯示 Total_Depth（公尺，整數）
4. THE System SHALL 顯示本輪 Descent_Depth（公尺，整數）
5. THE System SHALL 顯示當前 Zone 名稱
6. THE System SHALL 顯示 Completed_Rounds
7. THE System SHALL 顯示已解鎖卡片名稱清單
8. WHEN 在 IDLE 狀態，THE System SHALL 顯示時長選項按鈕（15/25/45 分鐘）
9. WHEN 在 IDLE 狀態且已選擇時長，THE System SHALL 顯示 START DESCENT 按鈕
10. WHEN 在 FOCUSING 狀態，THE System SHALL 顯示放棄按鈕
11. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態，THE System SHALL 顯示跳過按鈕
12. WHEN 在 ENDING 狀態，THE System SHALL 顯示 "dive again" 按鈕
13. WHEN 在 IDLE 狀態且 Total_Depth 曾達到 10900m，THE System SHALL 顯示低調的 "dive again" 按鈕
14. THE System SHALL 提供低調的「測試分心」按鈕手動觸發 Distraction_Event
15. THE System SHALL 提供 Demo_Mode 切換開關（只在 IDLE 狀態可用）
16. THE System SHALL 提供清除資料按鈕（需二次確認）

### 需求 13：單元測試覆蓋

**使用者故事：** 身為開發者，我想要完整的單元測試覆蓋核心邏輯，讓我能確保功能正確且避免迴歸錯誤。

#### 驗收標準

1. THE System SHALL 包含 Timer 模組的單元測試，涵蓋時間戳計算、分心時長扣除、Demo_Mode 加速、lastSeenAt 更新
2. THE System SHALL 包含 Depth_Calculator 模組的單元測試，涵蓋深度計算、Zone 判斷、上浮懲罰、深度下限保護
3. THE System SHALL 包含 State_Machine 模組的單元測試，涵蓋所有狀態轉換與非法轉換拒絕
4. THE System SHALL 包含 Codex 模組的單元測試，涵蓋卡片選擇邏輯、重複紀錄、Zone 限制、Supergiant amphipod 終局解鎖
5. THE System SHALL 包含 Storage 模組的單元測試，涵蓋儲存、載入、清除、lastSeenAt 復原
6. THE System SHALL 包含分心偵測邏輯的單元測試，涵蓋 5 秒閾值、單次觸發、上浮上限、隱藏時段時間排除
7. THE System SHALL 包含「重新下潛」功能的單元測試，涵蓋 Total_Depth 重置、Codex 保留、Completed_Rounds 保留
8. THE System SHALL 包含關頁後重開的單元測試，涵蓋 lastSeenAt 計算、時長上限、深度計算
9. WHERE 適合使用屬性測試（property-based testing），THE System SHALL 使用 fast-check 或類似工具
10. THE System SHALL 達到至少 80% 的測試覆蓋率（針對核心邏輯模組）

### 需求 14：Parser 與序列化（如適用）

**使用者故事：** 身為開發者，我想要正確解析與序列化 localStorage 資料，讓資料格式錯誤時能偵測並處理。

#### 驗收標準

1. WHEN Storage 從 localStorage 讀取資料，THE Storage SHALL 解析 JSON 字串為物件
2. WHEN Storage 寫入 localStorage，THE Storage SHALL 序列化物件為 JSON 字串
3. IF localStorage 資料格式無效，THEN THE Storage SHALL 記錄錯誤並使用預設值
4. IF localStorage 資料版本不相容，THEN THE Storage SHALL 嘗試遷移或使用預設值
5. THE Storage SHALL 定義資料結構的 TypeScript 型別
6. THE System SHALL 包含序列化/反序列化的往返測試（round-trip test）
