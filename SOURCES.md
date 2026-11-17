# 來源與授權狀態

參考網站：[引っ越しましたチャレンジ](https://tape-throw.pages.dev/)。2026-11-17（台北時間）重新讀取 HTML，並檢查其實際載入資源：

| 資源 | SHA-256 |
| --- | --- |
| `/physics.js?r=8` | `dc6365214ccad9058ea6b8c35e5ad164732d446f8d377ecb31a1905bccdbc92d` |
| `/theater-sim.js?r=3` | `c43afcf5aad3c32c13d2dbfd6402112b488a1e3361b84d29e4c6ab71525af5ae` |
| `/theater-view.js?r=6` | `f6c796ebc58f9ff4e209bd54d29b0577447cd4ced7164fc4c98eeaf56b2ae33e` |
| `/assets/index-CNU7axfJ.js` | `c2b3e7b84995ef93b75457b39af21fd8d423cd4bb87fb0c1469585742ae3629b` |

未找到作者維護的公開 repository 或上述遊戲程式的明確授權，亦未取得完整原始專案。公開可下載不等於開源或允許任意再散布。本次不把下載的完整 bundle、場館或物理檔案納入 repository，也不對其授予任何授權；既有及本次參照的公式、參數與行為在此保留出處。若要逐檔直接重用原站核心，仍需先取得作者的授權或明確授權文件。

`tests/reference-launch-fixtures.json` 是由該版本公開 `Tape.launchOf` API 產生的 20 組數值輸入／輸出，驗證發射速度與傾斜映射；並非原站原始碼或整體物理等價證明。

既有 Three.js r128 使用 MIT 授權，正式頁面延續透過 cdnjs 載入。測試開發依賴透過 npm 安裝 Three.js 與 Playwright，各自授權隨套件提供。TPE 的劇場、成員與原始內容沿用 repository 原有資料；本文件不改變其權利歸屬。

`tests/reference-roll-fixtures.json` 記錄原站無碰撞飛行在第 1、12、24 個彩帶步進的數值，用於驗證卷軸雙子步進；同樣不代表完整碰撞／繩帶等價。另參照原站視野比例、卷軸顯示交接、八人四排實績與稱號條件，使用 TPE 原有視覺樣式及獨立記錄模組實作。

`tests/artifacts/reference-play.png` 與 `tests/reference-interaction-log.txt` 為原站 WebGL 操作對照證據；畫面中的原站素材權利仍屬原作者，不是本專案的可再授權素材。
