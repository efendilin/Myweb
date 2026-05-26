/**
 * js/autocomplete.js — 醫學報告文字補完模組
 *
 * 詞庫來源：wordlist.js 的 WORDLIST_RAW 常數（需先載入）。
 * 首次啟動時將整理後的詞庫存入 localStorage（key: soloreport_wordlist），
 * 後續直接從 localStorage 讀取，加快啟動速度。
 *
 * 鍵盤快速鍵：
 *   Tab          → 套用第一筆（或已高亮）建議，textarea 留焦點
 *   Enter        → 套用已高亮建議（未高亮時不影響換行）
 *   ↑ / ↓       → 上下選取
 *   Escape       → 關閉選單
 */
const Autocomplete = (() => {

  /* ── 常數 ─────────────────────────────── */
  const LS_KEY     = 'soloreport_wordlist';   // localStorage 快取 key
  const LS_VER_KEY = 'soloreport_wordlist_v'; // 版本戳（更新詞庫時自動重建）
  const WORDLIST_VERSION = '1';               // 每次更新 WORDLIST_RAW 時遞增

  /* ── 私有狀態 ─────────────────────────── */
  let _words     = [];    // 去重、排序後的詞庫
  let _dropdown  = null;  // <ul> 浮動選單 DOM
  let _selIdx    = -1;    // 目前高亮索引（-1 = 無）
  let _curPrefix = '';    // 目前輸入的前綴

  /* ─────────────────────────────────────────
     建立浮動選單 DOM（只建一次，掛在 body）
  ───────────────────────────────────────── */
  function _createDropdown() {
    const ul = document.createElement('ul');
    ul.id        = 'autocomplete-dropdown';
    ul.className = 'autocomplete-dropdown';
    ul.setAttribute('role', 'listbox');
    ul.setAttribute('aria-label', '文字補完建議');
    ul.hidden = true;
    document.body.appendChild(ul);
    return ul;
  }

  /* ─────────────────────────────────────────
     詞庫初始化：
       1. 檢查 localStorage 版本是否匹配
       2. 匹配 → 直接使用快取
       3. 不匹配（首次或版本更新）→ 從 WORDLIST_RAW 重建並存入 localStorage
  ───────────────────────────────────────── */
  function _initWords() {
    try {
      const cachedVer = localStorage.getItem(LS_VER_KEY);
      if (cachedVer === WORDLIST_VERSION) {
        // 使用快取
        const cached = localStorage.getItem(LS_KEY);
        if (cached) {
          _words = JSON.parse(cached);
          console.info(`[Autocomplete] 從 localStorage 載入 ${_words.length} 個詞彙`);
          return;
        }
      }
    } catch (_) { /* localStorage 不可用或 JSON 解析失敗，重建 */ }

    // 從內建 WORDLIST_RAW 重建
    _rebuildFromRaw();
  }

  /**
   * 從 WORDLIST_RAW 常數建立去重、排序後的詞庫，
   * 並存入 localStorage 快取。
   */
  function _rebuildFromRaw() {
    if (typeof WORDLIST_RAW === 'undefined') {
      console.warn('[Autocomplete] WORDLIST_RAW 未定義，請確認 wordlist.js 已載入。');
      return;
    }

    const seen = new Set();
    _words = WORDLIST_RAW
      .map(w => w.trim())
      .filter(w => w.length >= 1)
      .filter(w => {
        const key = w.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    // 存入 localStorage
    try {
      localStorage.setItem(LS_KEY,     JSON.stringify(_words));
      localStorage.setItem(LS_VER_KEY, WORDLIST_VERSION);
      console.info(`[Autocomplete] 詞庫已建立並快取：${_words.length} 個詞彙`);
    } catch (_) {
      console.warn('[Autocomplete] localStorage 寫入失敗，僅使用記憶體版本。');
    }
  }

  /* ─────────────────────────────────────────
     取得游標前的「當前輸入前綴」
     允許：英數字、_ - / .（涵蓋醫學縮寫與複合詞）
  ───────────────────────────────────────── */
  function _getPrefix(ta) {
    const textBefore = ta.value.substring(0, ta.selectionStart);
    const m = textBefore.match(/[A-Za-z0-9_\-/.]+$/);
    return m ? m[0] : '';
  }

  /* ─────────────────────────────────────────
     前綴比對，回傳最多 max 筆建議
     排除與輸入完全相同的詞（大小寫不敏感）
  ───────────────────────────────────────── */
  function _getSuggestions(prefix, max = 10) {
    if (!prefix || prefix.length < 2) return [];
    const lower = prefix.toLowerCase();
    const results = [];
    for (const w of _words) {
      if (w.toLowerCase().startsWith(lower) && w.toLowerCase() !== lower) {
        results.push(w);
        if (results.length >= max) break;
      }
    }
    return results;
  }

  /* ─────────────────────────────────────────
     游標座標計算（mirror-div 技術）
     原理：在 off-screen 複製 textarea 的排版，
     利用 <span> 標記游標位置，反算 viewport 座標。
     回傳：{ top, left }（fixed 定位座標）
  ───────────────────────────────────────── */
  function _getCaretCoords(ta) {
    const style  = window.getComputedStyle(ta);
    const mirror = document.createElement('div');

    // 複製排版相關屬性
    [
      'boxSizing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'borderTopStyle',
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
      'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing',
      'whiteSpace', 'wordBreak', 'overflowWrap',
    ].forEach(p => { mirror.style[p] = style[p]; });

    // 寬度需與 textarea 相同才能正確換行
    mirror.style.width      = ta.getBoundingClientRect().width + 'px';
    mirror.style.position   = 'fixed';
    mirror.style.top        = '-9999px';
    mirror.style.left       = '-9999px';
    mirror.style.height     = 'auto';
    mirror.style.overflow   = 'visible';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';

    document.body.appendChild(mirror);

    // 填入游標前的文字
    mirror.textContent = ta.value.substring(0, ta.selectionStart);

    // 游標標記 span（zero-width space，不佔寬度）
    const caretSpan = document.createElement('span');
    caretSpan.textContent = '​';
    mirror.appendChild(caretSpan);

    const taRect     = ta.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const caretRect  = caretSpan.getBoundingClientRect();

    document.body.removeChild(mirror);

    return {
      top:  taRect.top  + (caretRect.bottom - mirrorRect.top)  - ta.scrollTop,
      left: taRect.left + (caretRect.left   - mirrorRect.left) - ta.scrollLeft,
    };
  }

  /* ─────────────────────────────────────────
     顯示選單
  ───────────────────────────────────────── */
  function _show(suggestions, ta) {
    _dropdown.innerHTML = '';
    _selIdx = -1;

    const prefixLen = _curPrefix.length;

    suggestions.forEach(word => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.word = word;

      // 高亮前綴部分
      li.innerHTML =
        `<span class="ac-hl">${_esc(word.slice(0, prefixLen))}</span>` +
        _esc(word.slice(prefixLen));

      // mousedown（非 click）：防止 blur 搶先執行
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        _accept(word, ta);
      });

      _dropdown.appendChild(li);
    });

    // 計算位置（考慮視窗邊界）
    const { top, left } = _getCaretCoords(ta);
    const vpH   = window.innerHeight;
    const vpW   = window.innerWidth;
    const dropH = Math.min(suggestions.length * 26 + 10, 244);
    const dropW = 240;
    const lh    = parseFloat(window.getComputedStyle(ta).lineHeight) || 26;

    const finalTop  = (top + dropH > vpH)
      ? Math.max(4, top - dropH - lh)
      : Math.min(top, vpH - dropH - 4);
    const finalLeft = Math.max(4, Math.min(left, vpW - dropW - 4));

    _dropdown.style.top  = finalTop  + 'px';
    _dropdown.style.left = finalLeft + 'px';
    _dropdown.hidden = false;
  }

  /* ─────────────────────────────────────────
     隱藏選單
  ───────────────────────────────────────── */
  function _hide() {
    _dropdown.hidden = true;
    _selIdx = -1;
  }

  /* ─────────────────────────────────────────
     選取高亮
  ───────────────────────────────────────── */
  function _highlight(idx) {
    const items = Array.from(_dropdown.querySelectorAll('li'));
    items.forEach((li, i) => li.classList.toggle('selected', i === idx));
    _selIdx = idx;
    if (idx >= 0) items[idx]?.scrollIntoView({ block: 'nearest' });
  }

  /* ─────────────────────────────────────────
     套用補完：取代游標前的當前詞，游標移至詞尾
  ───────────────────────────────────────── */
  function _accept(word, ta) {
    const pos       = ta.selectionStart;
    const before    = ta.value.substring(0, pos);
    const after     = ta.value.substring(pos);
    const newBefore = before.replace(/[A-Za-z0-9_\-/.]+$/, word);

    ta.value = newBefore + after;
    ta.selectionStart = ta.selectionEnd = newBefore.length;

    _hide();

    // 通知 input 事件（行號更新、自動儲存）
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  }

  /* ─────────────────────────────────────────
     HTML 字元跳脫（防止 XSS）
  ───────────────────────────────────────── */
  function _esc(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─────────────────────────────────────────
     綁定單一 textarea 的所有事件
  ───────────────────────────────────────── */
  function _bindTextarea(ta) {

    // input：每次內容變動後重算建議
    ta.addEventListener('input', () => {
      _curPrefix = _getPrefix(ta);
      const suggs = _getSuggestions(_curPrefix);
      if (suggs.length > 0) {
        _show(suggs, ta);
      } else {
        _hide();
      }
    });

    // keydown：導航 / 套用 / 關閉
    ta.addEventListener('keydown', (e) => {
      if (_dropdown.hidden) return;

      const items = _dropdown.querySelectorAll('li');
      const count = items.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          _highlight((_selIdx + 1) % count);
          break;

        case 'ArrowUp':
          e.preventDefault();
          _highlight((_selIdx - 1 + count) % count);
          break;

        case 'Tab': {
          // Tab 套用第一筆（或已高亮）建議；不切換焦點
          e.preventDefault();
          const i = _selIdx >= 0 ? _selIdx : 0;
          const w = items[i]?.dataset.word;
          if (w) _accept(w, ta);
          break;
        }

        case 'Enter': {
          // Enter 只在有明確高亮時才套用（不干擾一般換行）
          if (_selIdx >= 0) {
            e.preventDefault();
            const w = items[_selIdx]?.dataset.word;
            if (w) _accept(w, ta);
          }
          break;
        }

        case 'Escape':
          e.preventDefault();
          _hide();
          break;
      }
    });

    // blur：延遲隱藏，讓 mousedown 有機會先觸發
    ta.addEventListener('blur', () => {
      setTimeout(_hide, 160);
    });

    // 捲動時隱藏選單（位置會跑掉）
    ta.addEventListener('scroll', _hide);
  }

  /* ─────────────────────────────────────────
     公開 API
  ───────────────────────────────────────── */

  /**
   * 初始化補完模組（同步）。
   * 從 localStorage 快取或 WORDLIST_RAW 載入詞庫，
   * 再綁定所有 .report-textarea 事件。
   *
   * @param {string} [selector='.report-textarea']
   */
  function init(selector = '.report-textarea') {
    _dropdown = _createDropdown();
    _initWords();   // 同步初始化，無需 await
    document.querySelectorAll(selector).forEach(_bindTextarea);
  }

  return { init };
})();
