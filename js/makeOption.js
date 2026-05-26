/* js/makeOption.js — 模板 DSL 解析器與表單結果萃取器
 *
 * 支援語法：
 *   H{a|b|c}   橫向單選 (radio)
 *   V{a|b|c}   縱向單選 (radio)
 *   M{a|b|c}   複選 checkbox (and/comma-and 連接)
 *   m{a|b|c}   複選 checkbox (空格連接)
 *   P{a|b|c}   複選 checkbox (、連接)
 *   Ms{a|b}    複選 checkbox (；連接)
 *   L{a|b|c}   複選 checkbox (換行連接)
 *   G3{a|b|c}  N 欄 grid checkbox
 *   C{a|b}     下拉選單 (1個選項時為 checkbox)
 *   LE[]       行內文字輸入
 *   +option    設為預設值
 *   block[N]   引用第 N 個 DSL token 的結果
 *   #{...}     忽略的注解（完全不顯示、不輸出）
 *   C(text)    顯示用註解（灰色文字顯示於選項畫面，輸出時不包含）
 *
 * 依賴：utils.js (jointer, replace_plus)
 */

// ─── 正規表達式 ────────────────────────────────────────────────
// C\([^)]*\) 必須排在 C\{[^}]*\} 之前，確保小括號語法優先被分割
const DSL_SPLIT_RE = /(G\d+\{[^}]*\}|Ms\{[^}]*\}|M[/]?\{[^}]*\}|m[/]?\{[^}]*\}|P\{[^}]*\}|H\{[^}]*\}|h\{[^}]*\}|V\{[^}]*\}|v\{[^}]*\}|L\{[^}]*\}|C\([^)]*\)|C\{[^}]*\}|c\{[^}]*\}|#\{[^}]*\}|\r?\n)/;
const DSL_TOKEN_RE = /^(G\d+|Ms|M[/]?|m[/]?|P|H|h|V|v|L|C|c|#)\{([^}]*)\}$/;
const SUB_OP_RE    = /(H\[[^\]]*\]|P\[[^\]]*\]|Ms\[[^\]]*\]|M[/]?\[[^\]]*\]|m[/]?\[[^\]]*\]|LE\[[^\]]*\]|C\[[^\]]*\]|L\[[^\]]*\])/;
const BLINK_RE     = /LE\[[^\]]*\]/;
const BLINK_SPLIT  = /(LE\[[^\]]*\])/;

// 多選分隔符 (undefined = jointer 英文 and 格式)
const SEPER_PAIR = {
  'm':   ' ',
  'm/':  ' ',
  'M/':  '\n',
  'L':   '\n',
  'P':   '、',
  'Ms':  '；',
  'Ms/': '；',
};

/* 跳脫巢狀方括號內的 | 為 |& (同 reference 做法)，
   分割後再還原 */
function _escNested(str) {
  return str.replace(/[HPMmLCG][s/]?\[[^\]]*\]/g, m => m.replace(/\|/g, '|&'));
}

/* ─────────────────────────────────────────────
   公開 API
   ───────────────────────────────────────────── */

/** DSL 文字 → <form> DOM 元素 */
function buildForm(mainText) {
  const form = document.createElement('form');
  form.className = 'opt-form';
  form.addEventListener('submit', e => e.preventDefault());

  mainText.split(DSL_SPLIT_RE).forEach((seg, idx) => {
    // 空字串 / #{...} 完全略過
    if (!seg || /^#\{/.test(seg)) return;

    const wrapper = document.createElement('div');

    // C(text) — 顯示用註解：灰色文字，輸出時為空
    const commentMatch = /^C\(([^)]*)\)$/.exec(seg);
    if (commentMatch) {
      const sp = document.createElement('span');
      sp.className = 'opt-comment';
      sp.textContent = commentMatch[1];
      wrapper.appendChild(sp);
      form.appendChild(wrapper);
      return;
    }

    const tok = DSL_TOKEN_RE.exec(seg);
    if (tok) {
      wrapper.appendChild(_buildAny(tok[1], tok[2], String(idx)));
    } else if (BLINK_RE.test(seg)) {
      wrapper.appendChild(_buildBlink(seg, String(idx)));
    } else if (seg === '\n' || seg === '\r\n') {
      wrapper.appendChild(document.createElement('br'));
    } else {
      const sp = document.createElement('span');
      sp.className = 'opt-text-label';
      sp.textContent = seg;
      wrapper.appendChild(sp);
    }
    form.appendChild(wrapper);
  });
  return form;
}

/** 從 form 萃取填入值 → 報告文字 (替換 block[N]) */
function extractFormResult(form, mainText) {
  const blockVals = [];

  const parts = mainText.split(DSL_SPLIT_RE).map((seg, idx) => {
    // 空字串 / #{...} / C(text) 皆不輸出
    if (!seg || /^#\{/.test(seg) || /^C\([^)]*\)$/.test(seg)) return '';

    const tok = DSL_TOKEN_RE.exec(seg);
    if (tok) {
      const val = _extractToken(form, tok[1], String(idx));
      blockVals.push(val);
      return val;
    }

    if (BLINK_RE.test(seg)) {
      return seg.split(BLINK_SPLIT).map((p, pi) => {
        if (!p) return '';
        if (BLINK_RE.test(p)) {
          const inp = form.querySelector('[name="' + idx + '_blink_' + pi + '"]');
          return inp ? inp.value : '';
        }
        return p;
      }).join('');
    }

    return seg;
  });

  return parts.join('').replace(/block\[(\d+)\]/g,
    (_, n) => blockVals[+n] != null ? blockVals[+n] : '');
}

/** 判斷是否包含 DSL 互動 token */
function hasDSLTokens(mainText) {
  return DSL_SPLIT_RE.test(mainText);
}

/* ─────────────────────────────────────────────
   內部：元件建構
   ───────────────────────────────────────────── */

function _buildAny(type, optStr, idx, cb) {
  // 跳脫巢狀方括號內的 |
  const escaped = _escNested(optStr);
  // 分割外層選項 (不含 |& 位置)
  const opts = escaped.split(/\|(?!&)/).map(o => o.replace(/\|&/g, '|'));

  const box = document.createElement('div');

  if (/^G(\d+)/.test(type)) {
    box.className = 'opt-grid';
    _buildGrid(box, opts, idx, +type.slice(1) || 3);
    return box;
  }

  const norm = type.replace(/\//g, '');

  switch (norm) {
    case 'H': case 'h':
      box.className = 'opt-row';
      _buildRadios(box, opts, idx, cb, false);
      break;
    case 'V': case 'v':
      box.className = 'opt-row vertical';
      _buildRadios(box, opts, idx, cb, true);
      break;
    case 'M': case 'm': case 'P': case 'Ms': case 'L':
      box.className = 'opt-row vertical';
      _buildChecks(box, opts, idx, cb, type);
      break;
    case 'C': case 'c':
      box.className = 'opt-row';
      _buildSelect(box, opts, idx);
      break;
    default:
      box.textContent = '[?:' + type + ']';
  }
  return box;
}

/* Radio 群組 */
function _buildRadios(box, opts, idx, cb, vertical) {
  opts.forEach((opt, i) => {
    const rp = replace_plus(opt);
    const id = idx + '_' + i;
    if (SUB_OP_RE.test(rp.option)) {
      const parts = rp.option.split(SUB_OP_RE).filter(Boolean);
      box.appendChild(_buildCompound(parts, id, idx, vertical ? 'V' : 'H', rp.is_default));
      return;
    }
    const lbl = document.createElement('label');
    lbl.className = 'opt-radio-item';
    const inp = document.createElement('input');
    // value 使用移除 C() 標記後的純文字；label 則保留 C() 作為灰色行內註解
    Object.assign(inp, { type: 'radio', name: idx, id, value: _stripComments(rp.option) });
    if (rp.is_default) inp.defaultChecked = true;
    if (cb) inp.addEventListener('change', cb);
    const sp = document.createElement('span');
    sp.className = 'opt-label';
    _buildLabelContent(sp, rp.option);
    lbl.append(inp, sp);
    box.appendChild(lbl);
  });
}

/* Checkbox 群組 */
function _buildChecks(box, opts, idx, cb, type) {
  opts.forEach((opt, i) => {
    const rp = replace_plus(opt);
    const id = idx + '_' + i;
    if (SUB_OP_RE.test(rp.option)) {
      const parts = rp.option.split(SUB_OP_RE).filter(Boolean);
      box.appendChild(_buildCompound(parts, id, idx, type || 'M', rp.is_default));
      return;
    }
    const lbl = document.createElement('label');
    lbl.className = 'opt-check-item';
    const inp = document.createElement('input');
    Object.assign(inp, { type: 'checkbox', name: idx, id, value: _stripComments(rp.option) });
    if (rp.is_default) inp.defaultChecked = true;
    if (cb) inp.addEventListener('change', cb);
    const sp = document.createElement('span');
    sp.className = 'opt-label';
    _buildLabelContent(sp, rp.option);
    lbl.append(inp, sp);
    box.appendChild(lbl);
  });
}

/* Grid */
function _buildGrid(box, opts, idx, cols) {
  for (let r = 0; r < opts.length; r += cols) {
    const row = document.createElement('div');
    row.className = 'opt-grid-row';
    opts.slice(r, r + cols).forEach((opt, ci) => {
      const cell = document.createElement('span');
      cell.className = 'opt-grid-cell';
      if (opt.trim().toLowerCase() === 'blank') { row.appendChild(cell); return; }
      const rp = replace_plus(opt);
      const id = 'G_' + idx + '_' + r + '_' + ci;
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'checkbox', name: idx, id, value: _stripComments(rp.option) });
      if (rp.is_default) inp.defaultChecked = true;
      const lbl = document.createElement('label');
      lbl.htmlFor = id;  lbl.className = 'opt-label';
      _buildLabelContent(lbl, rp.option);
      cell.append(inp, lbl);
      row.appendChild(cell);
    });
    box.appendChild(row);
  }
}

/* Select / single-checkbox */
function _buildSelect(box, opts, idx) {
  if (opts.length === 1) {
    const rp  = replace_plus(opts[0]);
    const lbl = document.createElement('label');
    lbl.className = 'opt-check-item';
    const inp = document.createElement('input');
    Object.assign(inp, { type: 'checkbox', name: idx, id: idx + '_c0', value: _stripComments(rp.option) });
    inp.defaultChecked = rp.is_default;
    const sp = document.createElement('span');
    sp.className = 'opt-label';
    _buildLabelContent(sp, rp.option);
    lbl.append(inp, sp);
    box.appendChild(lbl);
  } else {
    const sel = document.createElement('select');
    sel.name = idx;  sel.className = 'opt-select';
    const empty = document.createElement('option');
    Object.assign(empty, { value: '', textContent: '-- 略過 --' });
    sel.appendChild(empty);
    opts.forEach(opt => {
      const rp  = replace_plus(opt);
      const o   = document.createElement('option');
      // <option> 不支援富文字，直接移除 C() 標記
      const clean = _stripComments(rp.option);
      o.value = clean;  o.textContent = clean;
      if (rp.is_default) o.selected = true;
      sel.appendChild(o);
    });
    box.appendChild(sel);
  }
}

/* 複合選項 (綠底) */
function _buildCompound(parts, label, idx, parentType, isDefault) {
  let curVal = _compoundDefault(parts);

  const row = document.createElement('div');
  row.className = 'opt-compound';

  const isRadio = /^[VvHh]$/.test(parentType);
  const main = document.createElement('input');
  Object.assign(main, { type: isRadio ? 'radio' : 'checkbox', name: idx, id: label, value: curVal });
  main.checked = isDefault;
  row.appendChild(main);

  const sync = () => {
    let t = '';
    parts.forEach((part, pi) => {
      const sid = label + '_s' + pi;
      const sm = _smatch(part);
      // 純文字段：移除其中的 C() 標記再加入值
      if (!sm) { t += _stripComments(part); return; }
      if (sm.type === 'LE') {
        const el = document.querySelector('[name="' + sid + '"]');
        t += el ? el.value : '';
      } else {
        const vals = Array.from(document.querySelectorAll('[name="' + sid + '"]:checked')).map(e => e.value);
        t += jointer(vals, SEPER_PAIR[sm.type]);
      }
    });
    main.value = t;  main.checked = true;
  };

  parts.forEach((part, pi) => {
    const sid = label + '_s' + pi;
    const sm  = _smatch(part);
    if (!sm) {
      // 純文字段：顯示時保留 C() 灰色行內註解
      const lbl = document.createElement('label');
      lbl.htmlFor = label;  lbl.className = 'opt-label';
      _buildLabelContent(lbl, part);
      row.appendChild(lbl);
      return;
    }
    const cell = document.createElement('span');
    if (sm.type === 'LE') {
      const inp = document.createElement('input');
      inp.type = 'text';  inp.name = sid;  inp.className = 'opt-text-input';
      inp.addEventListener('input', sync);
      cell.appendChild(inp);
    } else if (sm.type === 'H') {
      sm.content.split('|').forEach(opt => {
        const rp = replace_plus(opt);
        const lbl = document.createElement('label');
        lbl.className = 'opt-radio-item';
        const inp = document.createElement('input');
        inp.type = 'radio';  inp.name = sid;  inp.value = _stripComments(rp.option);
        if (rp.is_default) inp.defaultChecked = true;
        inp.addEventListener('change', sync);
        const sp = document.createElement('span');
        sp.className = 'opt-label';
        _buildLabelContent(sp, rp.option);
        lbl.append(inp, sp);
        cell.appendChild(lbl);
      });
    } else {
      sm.content.split('|').forEach(opt => {
        const rp = replace_plus(opt);
        const lbl = document.createElement('label');
        lbl.className = 'opt-check-item';
        const inp = document.createElement('input');
        inp.type = 'checkbox';  inp.name = sid;  inp.value = _stripComments(rp.option);
        if (rp.is_default) inp.defaultChecked = true;
        inp.addEventListener('change', sync);
        const sp = document.createElement('span');
        sp.className = 'opt-label';
        _buildLabelContent(sp, rp.option);
        lbl.append(inp, sp);
        cell.appendChild(lbl);
      });
    }
    row.appendChild(cell);
  });
  return row;
}

/* 行內輸入框 */
function _buildBlink(text, idx) {
  const box = document.createElement('div');
  box.className = 'opt-row';
  text.split(BLINK_SPLIT).forEach((p, pi) => {
    if (!p) return;
    if (BLINK_RE.test(p)) {
      const inp = document.createElement('input');
      inp.type = 'text';  inp.name = idx + '_blink_' + pi;  inp.className = 'opt-text-input';
      box.appendChild(inp);
    } else {
      const sp = document.createElement('span');
      sp.className = 'opt-text-label';  sp.textContent = p;
      box.appendChild(sp);
    }
  });
  return box;
}

/* ─────────────────────────────────────────────
   內部：萃取單一 token 的值
   ───────────────────────────────────────────── */
function _extractToken(form, type, name) {
  const norm = type.replace(/\//g, '');
  let eff = norm;
  if (/^G\d+$/.test(type)) eff = 'G';

  if (eff === 'C' || eff === 'c') {
    const sel = form.querySelector('select[name="' + name + '"]');
    if (sel) return sel.value;
    const chk = form.querySelector('input[type="checkbox"][name="' + name + '"]:checked');
    return chk ? chk.value : '';
  }

  if (/^[HhVv]$/.test(eff)) {
    const r = form.querySelector('input[type="radio"][name="' + name + '"]:checked');
    return r ? r.value : '';
  }

  // 複選
  const vals = Array.from(form.querySelectorAll('input[type="checkbox"][name="' + name + '"]:checked')).map(e => e.value);
  return jointer(vals, SEPER_PAIR[type]);
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

/** 解析子選項 e.g. H[a|b] → {type, content} */
function _smatch(str) {
  const m = /^(H|P|Ms|M[/]?|m[/]?|L|LE|C)\[([^\]]*)\]$/.exec(str);
  return m ? { type: m[1], content: m[2] } : null;
}

/**
 * 移除選項文字中的所有 C(...) 標記，回傳純輸出用字串。
 * 例：'test1 C(說明)' → 'test1'
 */
function _stripComments(text) {
  return text.replace(/C\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 將選項文字（可含 C() 標記）渲染為帶有灰色行內註解的子節點，附加至 el。
 * 普通文字以 TextNode 呈現；C(text) 以 <span class="opt-inline-comment"> 呈現。
 * 例：'test1 C(說明)' → TextNode('test1 ') + <span class="opt-inline-comment">說明</span>
 */
function _buildLabelContent(el, text) {
  const re = /C\(([^)]*)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    // 普通文字段
    if (match.index > lastIndex) {
      el.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    // C() 標記 → 灰色行內 span
    const cs = document.createElement('span');
    cs.className = 'opt-inline-comment';
    cs.textContent = match[1];
    el.appendChild(cs);
    lastIndex = match.index + match[0].length;
  }
  // 剩餘普通文字
  if (lastIndex < text.length) {
    el.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

/** 計算複合預設值 */
function _compoundDefault(parts) {
  return parts.map(part => {
    const sm = _smatch(part);
    // 純文字段：移除其中的 C() 標記
    if (!sm) return _stripComments(part);
    if (sm.type === 'LE') return sm.content || '';
    const defs = sm.content.split('|').filter(o => o[0] === '+')
      .map(o => _stripComments(o.slice(1)));  // 預設值也需移除 C() 標記
    if (!defs.length) return '';
    return sm.type === 'H' ? defs[0] : jointer(defs, SEPER_PAIR[sm.type]);
  }).join('');
}
