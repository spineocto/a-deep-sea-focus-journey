# Spec 1 提示詞（貼進 Kiro 的 Spec 模式）

> 用法：Kiro IDE → 開啟這個 repo → 左側 Kiro 面板 → Spec → 把下面「提示詞」整段貼進去。

## 提示詞

請先讀 .kiro/steering/ 裡的四份文件（product.md、tech.md、visual-style.md、language.md），全部照做。

這是第一個 spec，名稱叫「focus-core」，只做專注計時的核心，不做美術。

範圍（只做這些）：
1. 用 Vite + TypeScript 建好專案骨架，能 npm run dev 跑起來。
2. 一個集中設定檔（config），放 product.md 裡「Default parameters」的所有數字。
3. 狀態機：IDLE → FOCUSING → DISTRACTED ↔ FOCUSING → SHORT_BREAK / LONG_BREAK → FOCUSING … → ENDING，不要用零散的布林值。
4. 計時與深度：選 15/25/45 分鐘，按 START DESCENT 開始。時間和深度一律用時間戳計算（每專注一分鐘下沉 12m），切分頁回來也要準。
5. 照 product.md 的「Mechanic rules」：分心（分頁隱藏超過 5 秒算一次、一段只算一次、上浮本輪下沉的 20%、每輪最多 50%）、沒有暫停鍵、放棄保留深度不發卡、專注中關掉頁面算放棄、每 4 輪長休息、10,900m 進入 ENDING。
6. 圖鑑解鎖邏輯：完成一輪發「還沒解鎖的最淺那一帶」的卡（資料照 docs/codex.md 的 6 張），只記錄資料，不做畫面。
7. 用 localStorage 存深度、輪數、圖鑑、設定；重新打開回到 IDLE。
8. 演示模式 ×60：時間加速，而且不寫進真實進度。
9. 先用最簡單的暫時畫面顯示：狀態、剩餘時間、深度、目前海域、已解鎖卡片名稱，加一個低調的「測試分心」按鈕。

先不要做：背景圖、潛水球、小章魚、巨眼動畫、音效、部署。

測試：計時、深度換算、狀態機、分心扣深度、圖鑑解鎖都要有單元測試（Vitest）。

請先產出 requirements.md，等我確認後再寫 design.md，再寫 tasks.md。文件用繁體中文，程式碼和檔名用英文。
