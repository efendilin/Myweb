[README.md](https://github.com/user-attachments/files/28251912/README.md)
# SoloReport

醫學影像報告編輯工具，提供模板快速插入、DSL 互動選項、多設定檔管理等功能。

---

## 簡介

SoloReport 是一個純前端的單頁 Web APP（無後端、無框架），專為核醫科 / 影像科醫師設計，主要用途是輔助撰寫 PET/CT 等影像報告。

- **離線可用**：所有資料存於瀏覽器 `localStorage`，不需網路或伺服器
- **雙模式**：可獨立以瀏覽器開啟，或嵌入 [My-Assist-V3](../my-assist-v3/) Chrome Extension 使用
- **模板驅動**：內建 DSL 語法，點選模板即可快速組合報告語句

---

## 快速啟動

使用 VS Code **Live Server** 開啟 `index.html`，或直接以瀏覽器開啟：

```
soloreport/index.html
```

---

## 主要功能

### 報告編輯
- **Findings / Comments** 雙分頁文字區，支援左側行號顯示
- 游標位置精準插入模板文字
- 文字補完（前綴比對，`Tab` 套用）

### 模板系統
- 左側樹狀列表，依**類別 / 部位 / 型態**三種維度篩選
- 快捷字 + `\` 觸發模板插入（免用滑鼠）
- 模板管理介面：新增、編輯、刪除、排序、切換類別

### 多設定檔（Profile）
- 每個 Profile 擁有獨立的模板庫
- 可新增、複製、刪除 Profile

### 病患管理
- 病患 ID combobox（可下拉選取已存擋病患）
- 每位病患儲存一份報告（自動合併更新）
- 自動儲存（輸入停頓 1 秒後觸發）

### 暫存選擇狀態
- 在「選擇選項」視窗點擊**暫存**，可保留目前的選項狀態於 `sessionStorage`
- 有暫存的模板在左側列表顯示**粉色底色**
- 下次開啟同一模板時自動還原選擇狀態
- 插入報告後自動清除暫存

---

## 模板 DSL 語法

| 語法 | 說明 | 輸出 |
|------|------|------|
| `H{a\|b\|c}` | 橫向單選（radio） | 其中一個選項 |
| `V{a\|b\|c}` | 縱向單選（radio） | 其中一個選項 |
| `M{a\|b\|c}` | 多選（checkbox），換行連接 | 勾選項目 |
| `m{a\|b\|c}` | 多選（checkbox），空格連接 | 勾選項目 |
| `G3{a\|b\|...}` | 3 欄格狀多選 | 勾選項目 |
| `C{a\|b}` | 下拉選單 | 選取值 |
| `L{a\|b}` | 縱向單選（較大選項） | 其中一個選項 |
| `LE[]` | 文字輸入框 | 使用者輸入的文字 |
| `\+option` | 設為預設選項 | — |
| `block[N]` | 引用第 N+1 個選項的結果 | 動態替換 |
| `C(text)` | 註解（僅顯示，不輸出） | 無 |

### 複合語法

在選項內可巢狀其他語法：

```
M{H[right|bilateral|left] frontal|H[right|bilateral|left] temporal}
```

---

## 資料儲存

| localStorage 鍵 | 內容 |
|----------------|------|
| `soloreport_profiles` | 模板庫、Profile 清單、位置清單、型態清單 |
| `soloreport_patients` | 病患清單 |
| `soloreport_reports` | 報告記錄 |
| `soloreport_wordlist` | 補完詞庫快取 |

`sessionStorage` 用於儲存模板的暫存狀態（分頁關閉後自動清除）。

---

## 檔案結構

```
soloreport/
├── index.html          # 主頁面
├── css/
│   └── app.css         # 全部樣式
└── js/
    ├── utils.js        # 通用工具（genId, insertAtCursor…）
    ├── makeOption.js   # DSL 解析器 → 互動表單
    ├── storage.js      # localStorage 讀寫層 + 預設模板資料
    ├── wordlist.js     # 補完詞庫（WORDLIST_RAW）
    ├── autocomplete.js # 文字補完模組
    └── app.js          # 主應用程式邏輯
```

---

## 與 My-Assist-V3 整合

當以 `?embed=1&patientId=xxx&examDate=YYYY-MM-DD` 參數載入時，SoloReport 進入 **Embed 模式**：

- Header 隱藏，顯示精簡病患資訊條
- 報告資料自動從 IndexedDB（Chrome Extension 共享）載入
- 插入後可透過 postMessage 傳回 HIS 系統

---

## 技術規格

- **平台**：純 HTML / CSS / JavaScript（ES2020+），無框架、無建置工具
- **開發伺服器**：VS Code Live Server（`localhost:5500`）
- **瀏覽器支援**：Google Chrome（現代版本）
