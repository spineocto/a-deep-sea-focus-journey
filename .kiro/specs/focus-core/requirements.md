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
- **Distraction_Event**: 分心事件，當使用者切換分頁超過 5 秒觸發
- **Round**: 一輪專注，完成後可獲得一張生物卡片
- **Zone**: 深度區間（Sunlit、Twilight、Midnight、Abyssal、Hadal）
- **Focused_Time**: 實際專注時間（排除分心時段）
- **Descent_Depth**: 本輪下沉深度
- **Total_Depth**: 累積總深度（跨 session 保留）

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
12. THE Config SHALL 包含 zones 定義（Sunlit 0-200m、Twilight 200-1000m、Midnight 1000-4000m、Abyssal 4000-6000m、Hadal 6000m+）

### 需求 3：狀態機實作

**使用者故事：** 身為開發者，我想要用明確的狀態機管理應用程式狀態，讓我能避免零散布林值帶來的複雜度與錯誤。

#### 驗收標準

1. THE State_Machine SHALL 定義 IDLE、FOCUSING、DISTRACTED、SHORT_BREAK、LONG_BREAK、ENDING 等狀態
2. WHEN 在 IDLE 狀態且使用者選擇時長並點擊 START DESCENT，THE State_Machine SHALL 轉換到 FOCUSING 狀態
3. WHEN 在 FOCUSING 狀態且觸發 Distraction_Event，THE State_Machine SHALL 轉換到 DISTRACTED 狀態
4. WHEN 在 DISTRACTED 狀態且使用者返回分頁，THE State_Machine SHALL 轉換回 FOCUSING 狀態
5. WHEN 在 FOCUSING 狀態且完成一輪（非長休息），THE State_Machine SHALL 轉換到 SHORT_BREAK 狀態
6. WHEN 在 FOCUSING 狀態且完成一輪（第 4、8、12... 輪），THE State_Machine SHALL 轉換到 LONG_BREAK 狀態
7. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態且休息完成或使用者跳過，THE State_Machine SHALL 轉換到 IDLE 狀態
8. WHEN 在 FOCUSING 狀態且 Total_Depth 達到 10900m，THE State_Machine SHALL 轉換到 ENDING 狀態
9. WHEN 在 ENDING 狀態且使用者確認，THE State_Machine SHALL 轉換到 IDLE 狀態
10. WHEN 在 FOCUSING 狀態且使用者點擊放棄，THE State_Machine SHALL 轉換到 IDLE 狀態
11. THE State_Machine SHALL 記錄當前狀態並允許查詢
12. THE State_Machine SHALL 拒絕非法狀態轉換

### 需求 4：計時器與時間戳追蹤

**使用者故事：** 身為使用者，我想要系統使用時間戳計算時間與深度，讓我切換分頁或系統節流時計時仍然準確。

#### 驗收標準

1. WHEN 使用者開始一輪專注，THE Timer SHALL 記錄開始時間戳
2. WHEN 查詢剩餘時間，THE Timer SHALL 用當前時間戳減去開始時間戳計算已流逝時間
3. WHEN 進入 DISTRACTED 狀態，THE Timer SHALL 記錄分心開始時間戳
4. WHEN 從 DISTRACTED 返回 FOCUSING，THE Timer SHALL 記錄分心結束時間戳並累積分心總時長
5. WHEN 查詢 Focused_Time，THE Timer SHALL 回傳（已流逝時間 - 分心總時長）
6. WHEN Demo_Mode 啟用，THE Timer SHALL 將時間流逝速度乘以 60
7. THE Timer SHALL 在每次 tick（例如 requestAnimationFrame）時重新計算而非累加
8. WHEN 一輪完成，THE Timer SHALL 回傳該輪的 Focused_Time

### 需求 5：深度計算

**使用者故事：** 身為使用者，我想要專注時間轉換成潛水球深度，讓我能看到自己的進展並朝 10,900m 目標前進。

#### 驗收標準

1. WHEN 查詢 Descent_Depth，THE Depth_Calculator SHALL 用 Focused_Time（分鐘）乘以 descentSpeedPerMinute
2. WHEN 查詢 Total_Depth，THE Depth_Calculator SHALL 回傳累積深度（包含先前 session）
3. WHEN 一輪完成，THE Depth_Calculator SHALL 將 Descent_Depth 加入 Total_Depth
4. WHEN 使用者放棄一輪，THE Depth_Calculator SHALL 將目前 Descent_Depth 加入 Total_Depth
5. WHEN Total_Depth 超過 targetDepth（10900m），THE Depth_Calculator SHALL 將 Total_Depth 限制在 targetDepth
6. WHEN 查詢當前 Zone，THE Depth_Calculator SHALL 根據 Total_Depth 回傳對應 Zone 名稱
7. THE Depth_Calculator SHALL 提供依據 Total_Depth 的 Zone 轉換檢查

### 需求 6：分心事件偵測與懲罰

**使用者故事：** 身為使用者，我想要系統偵測我是否切換分頁並計算懲罰，讓分心有實際後果但不會過度嚴厲。

#### 驗收標準

1. THE System SHALL 使用 Page_Visibility_API 偵測分頁隱藏
2. WHEN 在 FOCUSING 狀態且分頁隱藏超過 distractionThreshold（5 秒），THE System SHALL 觸發一次 Distraction_Event
3. WHEN 一段分頁隱藏期間，THE System SHALL 只觸發一次 Distraction_Event（不論隱藏多久）
4. WHEN 觸發 Distraction_Event，THE System SHALL 計算上浮深度為 Descent_Depth * distractionRisePercentage（20%）
5. WHEN 本輪累積上浮深度超過 Descent_Depth * maxDistractionRisePercentage（50%），THE System SHALL 將上浮深度限制在該上限
6. WHEN 計算上浮懲罰，THE Depth_Calculator SHALL 從 Descent_Depth 減去上浮深度
7. THE System SHALL 記錄本輪 Distraction_Event 次數
8. THE System SHALL 提供手動觸發 Distraction_Event 的測試方法

### 需求 7：休息計時

**使用者故事：** 身為使用者，我想要完成專注後進入休息階段，並能選擇等待或跳過休息。

#### 驗收標準

1. WHEN 進入 SHORT_BREAK 狀態，THE Timer SHALL 啟動 shortBreakDuration（5 分鐘）倒數
2. WHEN 進入 LONG_BREAK 狀態，THE Timer SHALL 啟動 longBreakDuration（15 分鐘）倒數
3. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態且使用者點擊跳過，THE System SHALL 立即完成休息並轉換到 IDLE
4. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態且倒數結束，THE System SHALL 自動轉換到 IDLE
5. THE System SHALL 判斷下一個休息是 SHORT_BREAK 或 LONG_BREAK（每 4 輪為 LONG_BREAK）

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
9. WHEN Total_Depth 達到 10900m，THE System SHALL 在 ENDING 狀態顯示 Supergiant amphipod 卡片（若尚未解鎖）

### 需求 9：遊戲機制規則

**使用者故事：** 身為使用者，我想要系統遵循明確的遊戲規則，讓行為可預測且公平。

#### 驗收標準

1. THE System SHALL 不提供暫停功能
2. WHEN 使用者在 FOCUSING 狀態點擊放棄，THE System SHALL 保留已獲得的 Descent_Depth 並加入 Total_Depth
3. WHEN 使用者在 FOCUSING 狀態點擊放棄，THE System SHALL 不發放卡片
4. WHEN 使用者在 FOCUSING 狀態關閉頁面，THE System SHALL 在下次開啟時視為放棄（深度保留）
5. WHEN 使用者在 SHORT_BREAK 或 LONG_BREAK 狀態關閉頁面，THE System SHALL 在下次開啟時視為休息完成
6. WHEN 使用者完成第 4、8、12... 輪，THE System SHALL 進入 LONG_BREAK 而非 SHORT_BREAK
7. WHEN Total_Depth 達到 10900m 且完成該輪，THE System SHALL 進入 ENDING 狀態
8. WHEN 在 ENDING 狀態，THE System SHALL 保持 Total_Depth 在 10900m
9. WHEN 在 ENDING 狀態後開始新輪，THE System SHALL 允許繼續計時但 Total_Depth 保持在底部

### 需求 10：本地儲存持久化

**使用者故事：** 身為使用者，我想要關閉瀏覽器後重新開啟時保留進度，讓我的累積深度與圖鑑不會遺失。

#### 驗收標準

1. THE Storage SHALL 將 Total_Depth 存入 localStorage
2. THE Storage SHALL 將已完成輪數存入 localStorage
3. THE Storage SHALL 將 Codex 解鎖紀錄存入 localStorage
4. THE Storage SHALL 將使用者設定存入 localStorage
5. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入 Total_Depth
6. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入已完成輪數
7. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入 Codex 解鎖紀錄
8. WHEN 應用程式啟動，THE Storage SHALL 從 localStorage 載入使用者設定
9. WHEN 應用程式啟動時有未完成的 FOCUSING 狀態，THE System SHALL 轉換到 IDLE 並保留已獲得深度
10. WHEN 應用程式啟動時有未完成的 SHORT_BREAK 或 LONG_BREAK 狀態，THE System SHALL 轉換到 IDLE
11. THE Storage SHALL 在每次狀態變更時自動儲存
12. THE Storage SHALL 提供清除所有資料的方法（用於重置或測試）

### 需求 11：演示模式

**使用者故事：** 身為開發者或展示者，我想要啟用加速演示模式，讓我能快速展示完整遊戲流程而不影響真實進度。

#### 驗收標準

1. THE System SHALL 提供啟用/停用 Demo_Mode 的切換開關
2. WHEN Demo_Mode 啟用，THE Timer SHALL 將時間流逝速度乘以 demoModeMultiplier（60）
3. WHEN Demo_Mode 啟用，THE Storage SHALL 使用獨立的 localStorage key（例如 demo_ 前綴）
4. WHEN Demo_Mode 停用，THE Storage SHALL 使用正常的 localStorage key
5. WHEN 切換 Demo_Mode，THE System SHALL 重新載入對應的儲存資料
6. THE System SHALL 在 UI 明確顯示目前是否為 Demo_Mode
7. WHEN Demo_Mode 啟用時的進度，THE System SHALL 不影響正常模式的進度

### 需求 12：暫時 UI 顯示

**使用者故事：** 身為開發者，我想要簡單的暫時 UI 顯示核心資訊與控制，讓我能測試所有功能而無需等待美術完成。

#### 驗收標準

1. THE System SHALL 顯示當前狀態名稱（IDLE、FOCUSING、DISTRACTED 等）
2. THE System SHALL 顯示剩餘時間（分:秒格式）
3. THE System SHALL 顯示 Total_Depth（公尺，整數）
4. THE System SHALL 顯示本輪 Descent_Depth（公尺，整數）
5. THE System SHALL 顯示當前 Zone 名稱
6. THE System SHALL 顯示已完成輪數
7. THE System SHALL 顯示已解鎖卡片名稱清單
8. WHEN 在 IDLE 狀態，THE System SHALL 顯示時長選項按鈕（15/25/45 分鐘）
9. WHEN 在 IDLE 狀態且已選擇時長，THE System SHALL 顯示 START DESCENT 按鈕
10. WHEN 在 FOCUSING 狀態，THE System SHALL 顯示放棄按鈕
11. WHEN 在 SHORT_BREAK 或 LONG_BREAK 狀態，THE System SHALL 顯示跳過按鈕
12. THE System SHALL 提供低調的「測試分心」按鈕手動觸發 Distraction_Event
13. THE System SHALL 提供 Demo_Mode 切換開關
14. THE System SHALL 提供清除資料按鈕（需二次確認）

### 需求 13：單元測試覆蓋

**使用者故事：** 身為開發者，我想要完整的單元測試覆蓋核心邏輯，讓我能確保功能正確且避免迴歸錯誤。

#### 驗收標準

1. THE System SHALL 包含 Timer 模組的單元測試，涵蓋時間戳計算、分心時長扣除、Demo_Mode 加速
2. THE System SHALL 包含 Depth_Calculator 模組的單元測試，涵蓋深度計算、Zone 判斷、上浮懲罰
3. THE System SHALL 包含 State_Machine 模組的單元測試，涵蓋所有狀態轉換與非法轉換拒絕
4. THE System SHALL 包含 Codex 模組的單元測試，涵蓋卡片選擇邏輯、重複紀錄、Zone 限制
5. THE System SHALL 包含 Storage 模組的單元測試，涵蓋儲存、載入、清除
6. THE System SHALL 包含分心偵測邏輯的單元測試，涵蓋 5 秒閾值、單次觸發、上浮上限
7. WHERE 適合使用屬性測試（property-based testing），THE System SHALL 使用 fast-check 或類似工具
8. THE System SHALL 達到至少 80% 的測試覆蓋率（針對核心邏輯模組）

### 需求 14：Parser 與序列化（如適用）

**使用者故事：** 身為開發者，我想要正確解析與序列化 localStorage 資料，讓資料格式錯誤時能偵測並處理。

#### 驗收標準

1. WHEN Storage 從 localStorage 讀取資料，THE Storage SHALL 解析 JSON 字串為物件
2. WHEN Storage 寫入 localStorage，THE Storage SHALL 序列化物件為 JSON 字串
3. IF localStorage 資料格式無效，THEN THE Storage SHALL 記錄錯誤並使用預設值
4. IF localStorage 資料版本不相容，THEN THE Storage SHALL 嘗試遷移或使用預設值
5. THE Storage SHALL 定義資料結構的 TypeScript 型別
6. THE System SHALL 包含序列化/反序列化的往返測試（round-trip test）

