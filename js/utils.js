/* js/utils.js — 共用工具函式 */

/**
 * 將多選結果陣列依指定分隔符號合併成字串。
 * 未指定分隔符號時使用英文 and / comma-and 格式。
 */
function jointer(list, seper) {
  if (!list || list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (seper !== undefined) return list.join(seper);
  if (list.length === 2) return list[0] + ' and ' + list[1];
  return list.slice(0, list.length - 1).join(', ') + ' and ' + list[list.length - 1];
}

/**
 * 解析選項前綴的 '+' 號，判斷是否為預設選中值。
 * 同時處理跳脫字元 '\+' → '+'。
 */
function replace_plus(option) {
  let is_default = false;
  if (option.charAt(0) === '+') {
    option = option.substring(1);
    is_default = true;
  }
  option = option.replace('\\+', '+');
  return { option, is_default };
}

/**
 * 在 textarea 游標位置插入文字；若無游標則附加於末端。
 * 插入後觸發 input 事件以同步狀態。
 */
function insertAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after  = textarea.value.substring(end);
  textarea.value = before + text + after;
  const newPos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = newPos;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * 產生簡易唯一 ID (時間戳 + 亂數)。
 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * 深複製物件 (JSON 序列化方式)。
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 顯示 Toast 通知。
 * @param {string} msg   - 訊息文字
 * @param {'success'|'error'|''} type - 類型 (影響背景色)
 * @param {number} duration - 顯示毫秒數 (預設 2200ms)
 */
function showToast(msg, type = '', duration = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  void el.offsetWidth; // reflow
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

/**
 * 觸發瀏覽器下載 JSON 檔案。
 */
function downloadJSON(data, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * 開啟檔案選擇對話框並讀取 JSON。
 * @param {function} callback - 接收解析後物件的回呼
 */
function openJSONFile(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        callback(data, file.name);
      } catch (err) {
        showToast('JSON 解析失敗：' + err.message, 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  });
  input.click();
}

/**
 * 取得今日日期字串 (YYYY-MM-DD)。
 */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
