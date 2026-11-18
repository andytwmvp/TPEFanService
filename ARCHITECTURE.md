# 程式架構

本分支以靜態部署為目標，將頁面、樣式、素材與遊戲原始碼分開管理。

## 檔案責任

- `index.html` 定義頁面結構、對話框與資源載入順序。
- `assets/styles.css` 管理既有介面與響應式樣式。
- `assets/media.js` 保存既有內嵌影像、音訊與素材載入流程。
- `src/app/manifest.json` 定義應用程式的組裝順序。
- `src/app/` 依環境、劇場、觀眾及演出者、鏡頭、音訊、飯灑設定與特殊觀眾、彩帶、飯灑流程、結果與匯出、導航與輸入、主迴圈分檔。
- `ribbon-world.js`、`ribbon-crowd.js`、`ribbon-records.js` 分別提供碰撞、觀眾姿勢及實績持久化。
- `assets/app.js` 是部署用產物，由原始碼組裝而成。

## 修改及組裝

修改對應的原始碼檔案後，執行：

```sh
python3 scripts/build.py
```

組裝需要 Python 3 與 Node.js（建議 22）。Python 使用標準函式庫，Node.js 負責 JavaScript 語法檢查，不需 npm 安裝。所有驗證成功後才更新部署產物與 HTML 資源雜湊。提交時包含原始碼及部署產物。預覽可使用：

```sh
python3 -m http.server 8080
```

提交前可執行 `python3 scripts/build.py --check`，唯讀檢查部署內容與資源雜湊。GitHub Actions 在 push 與 pull request 執行相同檢查；不會部署或修改分支。manifest 必須完整列出所有原始碼片段，且不可重複。

資源使用相對路徑，支援 GitHub Pages repository 子路徑。

## 作用域與邊界

應用程式片段仍組裝於同一閉包，保留既有函式提升、共用狀態及事件註冊順序。這些檔案是明確的原始碼責任邊界，尚未形成彼此隔離的執行時模組。後續要拆分狀態所有權或移至 ES modules，需逐一處理跨檔案存取及初始化順序。

測試、日誌與截圖保留於版本控制之外。素材與第三方內容沿用既有權利及授權狀態。
