/*global chrome*/

// ── State ────────────────────────────────────────────────────────────────
var _templates  = {};
var _current    = '';
var _cate       = '';
var _shortcut   = '';
var _dirty      = false;
var _debounceTimer = null;

// regex shared with makeOption.js (already declared there)
const _re      = /(G\d{.+?}|P.?{.+?}|M.?{.+?}|m.?{.+?}|H{.+?}|h{.+?}|V{.+?}|v{.+?}|L{.+?}|C{.+?}|c{.+?}|#{.+?}|\r?\n)/;
const _regexp  = /(^G\d|^P|^M.?|^m.?|^H|^h|^V|^v|^L|^#|^C|^c){(.+?)}/;
const _sep     = { m: ' ', L: '\n', P: '、', Ms: '；' };

// ── DOM refs ─────────────────────────────────────────────────────────────
const profileSel   = document.getElementById('profile-select');
const shortcutSel  = document.getElementById('shortcut-select');
const editorEl     = document.getElementById('editor');
const lineNums     = document.getElementById('line-nums');
const dirtyDot     = document.getElementById('dirty-dot');
const statusPos    = document.getElementById('status-pos');
const statusMsg    = document.getElementById('status-msg');
const statusChars  = document.getElementById('status-chars');
const formScroll   = document.getElementById('form-scroll');
const resultOverlay = document.getElementById('result-overlay');
const resultText   = document.getElementById('result-text');

// ── Line numbers ──────────────────────────────────────────────────────────
function updateLineNumbers() {
  const lines      = editorEl.value.split('\n');
  const cursorLine = editorEl.value.substr(0, editorEl.selectionStart).split('\n').length;
  lineNums.innerHTML = lines.map((_, i) => {
    const n = i + 1;
    return `<span${n === cursorLine ? ' class="active"' : ''}>${n}</span>`;
  }).join('');
  lineNums.scrollTop = editorEl.scrollTop;
}

// ── Status bar ────────────────────────────────────────────────────────────
function updateStatus() {
  const before = editorEl.value.substr(0, editorEl.selectionStart);
  const lines  = before.split('\n');
  statusPos.textContent   = `行 ${lines.length}，欄 ${lines[lines.length - 1].length + 1}`;
  statusChars.textContent = `${editorEl.value.length} 字元`;
}

// ── Dirty flag ────────────────────────────────────────────────────────────
function markDirty() {
  if (!_dirty) { _dirty = true; dirtyDot.classList.add('visible'); }
}
function clearDirty() {
  _dirty = false; dirtyDot.classList.remove('visible');
}

// ── Options form (right panel) ────────────────────────────────────────────
function renderForm(mainText) {
  formScroll.innerHTML = '';
  if (!mainText || !mainText.trim()) {
    formScroll.innerHTML = '<p class="form-empty">此樣板無選項內容</p>';
    return;
  }
  // Check if template has any option tokens
  const hasOptions = /(G\d{.+?}|P.?{.+?}|M.?{.+?}|m.?{.+?}|H{.+?}|h{.+?}|V{.+?}|v{.+?}|L{.+?}|C{.+?}|c{.+?}|#{.+?})/.test(mainText);
  if (!hasOptions) {
    formScroll.innerHTML = '<p class="form-empty">此樣板無需選項（純文字）</p>';
    return;
  }
  const form = buildForm(mainText);   // from makeOption.js
  formScroll.appendChild(form);
}

// Debounced re-render when textarea is edited
function scheduleFormRefresh() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    renderForm(editorEl.value);
  }, 600);
}

// ── Profile selector ──────────────────────────────────────────────────────
function renderProfileSelect() {
  const prev = _current;
  profileSel.innerHTML = '';
  Object.keys(_templates).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    profileSel.appendChild(opt);
  });
  profileSel.value = _templates[prev] ? prev : (Object.keys(_templates)[0] || '');
  _current = profileSel.value;
  renderShortcutSelect();
}

// ── Template selector ─────────────────────────────────────────────────────
function renderShortcutSelect() {
  const prev = shortcutSel.value;
  shortcutSel.innerHTML = '<option value="">— 選擇樣板 —</option>';
  const profile = _templates[_current];
  if (!profile) return;
  profile.category_list.forEach(cate => {
    if (!cate || !profile.category[cate]) return;
    const group = document.createElement('optgroup');
    group.label = cate;
    profile.category[cate].forEach(item => {
      if (!item) return;
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ cate, shortcut: item.shortcut });
      opt.textContent = item.shortcut + (item.description ? '  – ' + item.description : '');
      group.appendChild(opt);
    });
    shortcutSel.appendChild(group);
  });
  if ([...shortcutSel.options].some(o => o.value === prev)) shortcutSel.value = prev;
}

function loadTemplate(cate, shortcut) {
  const items = (_templates[_current]?.category[cate]) || [];
  const item  = items.find(i => i.shortcut === shortcut);
  if (!item) return;
  _cate = cate; _shortcut = shortcut;
  editorEl.value = item.main || '';
  clearDirty();
  updateLineNumbers();
  updateStatus();
  renderForm(item.main);
  showMsg('');
}

// ── Save ──────────────────────────────────────────────────────────────────
function saveTemplate() {
  if (!_current || !_cate || !_shortcut) { showMsg('請先選擇樣板', true); return; }
  const items = _templates[_current]?.category[_cate] || [];
  const idx   = items.findIndex(i => i.shortcut === _shortcut);
  if (idx === -1) { showMsg('找不到樣板', true); return; }
  items[idx].main = editorEl.value;
  chrome.storage.local.set({ templates: _templates }, () => {
    clearDirty();
    showMsg('已儲存 ✓');
    renderForm(editorEl.value);   // refresh form with saved text
  });
}

// ── OK: collect form values and show result ───────────────────────────────
function handleOK() {
  const form = formScroll.querySelector('form#main');
  if (!form) { showMsg('尚無選項表單', true); return; }

  const data    = new FormData(form);
  const mainText = editorEl.value;
  const matches  = [...mainText.split(_re)];
  var result     = {};

  for (var [key, val] of data.entries()) {
    if (key.indexOf('_') === -1) {
      if (key in result) result[key].push(val);
      else               result[key] = [val];
    }
  }

  let temp = '';
  matches.forEach((item, index) => {
    if (_regexp.test(item)) {
      if (index in result) {
        const type = item.split('{')[0];
        temp += _sep.hasOwnProperty(type) ? jointer(result[index], _sep[type]) : jointer(result[index]);
      }
    } else {
      temp += item;
    }
  });

  // block[N] substitution
  const re_block = /block\[(\d+)\]/g;
  if (re_block.test(temp)) {
    const keys = Object.keys(result);
    temp = temp.replace(/block\[(\d+)\]/g, (match, n) => {
      const k = keys[parseInt(n, 10)];
      return k ? result[k] : match;
    });
  }

  showResult(temp);
}

// ── Result overlay ────────────────────────────────────────────────────────
function showResult(text) {
  resultText.textContent = text;
  resultOverlay.classList.add('show');
}

document.getElementById('btn-result-close').addEventListener('click', () => {
  resultOverlay.classList.remove('show');
});

document.getElementById('btn-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(resultText.textContent).then(() => {
    showMsg('已複製到剪貼簿 ✓');
    resultOverlay.classList.remove('show');
  });
});

// Click outside result box to close
resultOverlay.addEventListener('click', e => {
  if (e.target === resultOverlay) resultOverlay.classList.remove('show');
});

// ── Cancel: reset form ────────────────────────────────────────────────────
function handleCancel() {
  if (_cate && _shortcut) {
    renderForm(editorEl.value);   // re-render resets all inputs to defaults
    showMsg('已重置選項');
  }
}

// ── Status message ────────────────────────────────────────────────────────
var _msgTimer = null;
function showMsg(text, isErr) {
  statusMsg.textContent = text;
  statusMsg.style.color = isErr ? '#f38ba8' : '#a6e3a1';
  clearTimeout(_msgTimer);
  if (text) _msgTimer = setTimeout(() => { statusMsg.textContent = ''; }, 3000);
}

// ── Button wiring ─────────────────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', saveTemplate);
document.getElementById('btn-ok').addEventListener('click', handleOK);
document.getElementById('btn-cancel').addEventListener('click', handleCancel);

// ── Editor events ─────────────────────────────────────────────────────────
editorEl.addEventListener('input', () => {
  markDirty();
  updateLineNumbers();
  updateStatus();
  scheduleFormRefresh();
});
editorEl.addEventListener('scroll', () => { lineNums.scrollTop = editorEl.scrollTop; });
editorEl.addEventListener('click',  updateStatus);
editorEl.addEventListener('keyup',  updateStatus);

editorEl.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveTemplate(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = editorEl.selectionStart, end = editorEl.selectionEnd;
    editorEl.value = editorEl.value.substring(0, s) + '  ' + editorEl.value.substring(end);
    editorEl.selectionStart = editorEl.selectionEnd = s + 2;
    updateLineNumbers(); updateStatus();
  }
});

// ── Selector events ───────────────────────────────────────────────────────
profileSel.addEventListener('change', () => {
  _current = profileSel.value;
  renderShortcutSelect();
  editorEl.value = ''; _cate = ''; _shortcut = '';
  clearDirty(); updateLineNumbers(); updateStatus();
  formScroll.innerHTML = '<p class="form-empty">← 選擇樣板後顯示選項</p>';
});

shortcutSel.addEventListener('change', () => {
  if (!shortcutSel.value) return;
  if (_dirty && !confirm('有未儲存的變更，確定要切換樣板嗎？')) {
    shortcutSel.value = _cate ? JSON.stringify({ cate: _cate, shortcut: _shortcut }) : '';
    return;
  }
  const { cate, shortcut } = JSON.parse(shortcutSel.value);
  loadTemplate(cate, shortcut);
});

// ── Init ──────────────────────────────────────────────────────────────────
chrome.storage.local.get(null, data => {
  _templates = data.templates || {};
  _current   = data.current   || Object.keys(_templates)[0] || '';
  renderProfileSelect();
  updateLineNumbers();
  updateStatus();
});

chrome.storage.onChanged.addListener((changed, area) => {
  if (area !== 'local' || !('templates' in changed)) return;
  _templates = changed.templates.newValue;
  const prevCate = _cate, prevShort = _shortcut;
  renderProfileSelect();
  if (prevCate && prevShort) {
    const val = JSON.stringify({ cate: prevCate, shortcut: prevShort });
    if ([...shortcutSel.options].some(o => o.value === val)) shortcutSel.value = val;
  }
});
