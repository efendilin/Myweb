/* js/app.js — SoloReport 主應用程式
 *
 * 依賴載入順序：data.js → utils.js → makeOption.js → storage.js → app.js
 */

/* ─────────────────────────────────────────────
   應用狀態
   ───────────────────────────────────────────── */
const App = {
  store: null,      // profiles store
  patients: [],
  reports: [],
  deptPatients: [], // HIS 科室今日病人清單（由 extension bridge 推送）

  leftFilter: { category: null, location: null, type: null },

  currentSection: 'findings',   // findings | comments
  activeTextarea: null,

  // 模板操作暫存
  optionsTemplate: null,    // { main, shortcut, description }
  savedCursorPos: 0,        // options modal 開啟時的游標位置
  editCtx: null,            // { profileName, category, index } — null 表示新增
  tmSelectedCate: null,
  tmSelectedIndex: null,
  _returnToManager: false,  // 從模板管理進入編輯器時設為 true，關閉編輯器後自動返回

  previewTimer: null,
};

/* ─────────────────────────────────────────────
   初始化
   ───────────────────────────────────────────── */
/* ─── Embed 模式偵測（URL param: ?embed=1&patientId=xxx&examDate=YYYY-MM-DD）────
   當 SoloReport 以 iframe 嵌入 HIS 頁面時，隱藏 header 與病患輸入欄位，
   改顯示精簡的病患資訊條，並自動從 localStorage / IndexedDB 載入對應報告。
─────────────────────────────────────────────────────────────────────────────── */
const _embedParams   = new URLSearchParams(location.search);
const _isEmbed       = _embedParams.get('embed') === '1';
const _embedPatId    = _embedParams.get('patientId')  || '';
const _embedExamDate = _embedParams.get('examDate')   || '';

/**
 * 從 localStorage 或 IndexedDB 載入指定病患的報告。
 * 若都找不到，自動建立空白報告。
 * @param {string} patientId
 * @param {string} examDate   YYYY-MM-DD
 */
function _loadEmbedPatient(patientId, examDate) {
  // 1. localStorage 中尋找
  const existing = App.reports.find(
    r => r.patient?.id === patientId && r.patient?.examDate === examDate
  );
  if (existing) { loadReport(existing); return; }

  // 2. 透過 background.js 查詢 IndexedDB（避免直接 open 時的版本衝突）
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'get_report_from_idb', patientId, examDate }, res => {
      if (chrome.runtime.lastError) {
        _createAndLoadBlankReport(patientId, examDate, {});
        return;
      }
      const idbRec = res?.ok ? res.report : null;
      if (idbRec && (idbRec.sections?.findings || idbRec.sections?.comments)) {
        // IDB 有實際內容（SoloReport 之前儲存過）→ 載入並同步至 localStorage
        upsertReport(App.reports, idbRec);
        loadReport(idbRec);
      } else {
        // IDB 只有空白 shell 或無資料 → 用 IDB 補充病患基本資訊後建立空白報告
        _createAndLoadBlankReport(patientId, examDate, idbRec?.patient || {});
      }
    });
  } else {
    _createAndLoadBlankReport(patientId, examDate, {});
  }
}

/**
 * 建立空白報告（使用 IDB 補充的欄位）並載入。
 */
function _createAndLoadBlankReport(patientId, examDate, idbPatient) {
  const report = {
    id:      genId(),
    profile: App.store.current,
    patient: {
      id:       patientId,
      name:     idbPatient.name     || '',
      examDate: examDate,
      modality: idbPatient.modality || 'PET/CT',
    },
    sections:  { findings: '', comments: '' },
    updatedAt: new Date().toISOString(),
  };
  upsertReport(App.reports, report);
  loadReport(report);
}

document.addEventListener('DOMContentLoaded', () => {
  App.store    = loadStore();
  App.patients = loadPatients();
  App.reports  = loadReports();

  renderAll();
  bindGlobalEvents();
  initPatientCombobox();
  initLineNumbers();
  initShortcutMonitor();        // shortcut + \ 快捷鍵觸發模板
  Autocomplete.init();          // 從 localStorage / WORDLIST_RAW 載入詞庫並啟用補完
  initHistoryNotePanel();       // History Note 側邊欄
  initExtensionBridge();
  syncPatientList();

  // 預設顯示 findings textarea
  App.activeTextarea = document.getElementById('report-findings');

  // 設定今天日期
  document.getElementById('exam-date').value = todayStr();

  // ── Embed 模式初始化 ──────────────────────────────────────────────────────
  if (_isEmbed) {
    document.body.classList.add('embed-mode');

    // 隱藏病患輸入欄（保留 autosave-field）—— CSS 已處理，JS 補強確保
    document.querySelectorAll('.patient-field:not(.autosave-field)')
            .forEach(f => f.style.display = 'none');

    // ── 左側工具列：把 header 中的 profile 選擇器與操作按鈕搬入 ──────────────
    // 因為是 DOM move（而非複製），事件監聽器與 getElementById 全部自動繼承，
    // renderProfileSelect() 等函式無需任何修改。
    const embedToolbar = document.getElementById('embed-left-toolbar');

    // 第一列：profile combobox（模板檔案選擇）
    const profileGroup = document.querySelector('#app-header .profile-group');
    if (profileGroup) {
      profileGroup.classList.add('embed-tb-profile');
      embedToolbar.appendChild(profileGroup);
    }

    // 第二列：模板管理 / 匯入 / 匯出
    const actionRow = document.createElement('div');
    actionRow.className = 'embed-tb-actions';
    ['btn-manage-templates', 'btn-import', 'btn-export'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) actionRow.appendChild(btn);
    });
    embedToolbar.appendChild(actionRow);

    // 插入精簡病患資訊條（ID / 姓名 / 日期 / 類型）
    const strip = document.createElement('div');
    strip.className = 'embed-patient-strip';
    strip.innerHTML =
      `<span class="epi-id">${_embedPatId}</span>` +
      `<span class="epi-name" id="embed-pt-name"></span>` +
      `<span class="epi-date">${_embedExamDate}</span>` +
      `<span class="epi-mod"  id="embed-pt-mod"></span>`;
    const patBar = document.getElementById('patient-bar');
    patBar.insertBefore(strip, patBar.querySelector('.patient-actions'));

    // 載入報告（延遲一 tick 確保 App.reports 已就緒）
    if (_embedPatId) {
      setTimeout(() => {
        _loadEmbedPatient(_embedPatId, _embedExamDate);
        // 載入後把姓名 / 類型填入資訊條
        const r = App.reports.find(
          rr => rr.patient?.id === _embedPatId && rr.patient?.examDate === _embedExamDate
        );
        if (r) {
          const nameEl = document.getElementById('embed-pt-name');
          const modEl  = document.getElementById('embed-pt-mod');
          if (nameEl) nameEl.textContent = r.patient?.name || '';
          if (modEl)  modEl.textContent  = r.patient?.modality || '';
        }
      }, 0);
    }
  } else {
    // 正常模式：科室病人清單日期預設今天，綁定載入按鈕
    document.getElementById('dept-date').value = todayStr();
    document.getElementById('btn-fetch-patients').addEventListener('click', () => {
      requestDeptPatients();
    });
  }
});

function renderAll() {
  renderProfileSelect();
  renderLeftFilters();
  renderRightFilters();
  renderTree();
  renderQuickButtons();
  renderPatientDatalist();
}

/* ─────────────────────────────────────────────
   Profile 下拉選單
   ───────────────────────────────────────────── */
function renderProfileSelect() {
  const sel = document.getElementById('profile-select');
  const current = App.store.current;
  sel.innerHTML = '';
  Object.keys(App.store.profiles).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ─────────────────────────────────────────────
   過濾器按鈕
   ───────────────────────────────────────────── */
function renderFilterRow(rowEl, items, currentVal, onClick) {
  const btnContainer = rowEl.querySelector('.filter-btns');
  btnContainer.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn' + (currentVal === null ? ' active' : '');
  allBtn.textContent = '全部';
  allBtn.addEventListener('click', () => onClick(null));
  btnContainer.appendChild(allBtn);

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (currentVal === item ? ' active' : '');
    btn.textContent = item;
    btn.addEventListener('click', () => onClick(item));
    btnContainer.appendChild(btn);
  });
}

function renderLeftFilters() {
  const prof = getCurrentProfile(App.store);

  // 三個過濾器互斥：選擇任一非「全部」的值時，其餘兩個自動重設為「全部」(null)
  renderFilterRow(
    document.getElementById('left-filter-category'),
    prof.category_list || [],
    App.leftFilter.category,
    val => {
      App.leftFilter.category = val;
      if (val !== null) { App.leftFilter.location = null; App.leftFilter.type = null; }
      renderLeftFilters(); renderTree();
    }
  );
  renderFilterRow(
    document.getElementById('left-filter-location'),
    App.store.locations_list || [],      // 全域清單
    App.leftFilter.location,
    val => {
      App.leftFilter.location = val;
      if (val !== null) { App.leftFilter.category = null; App.leftFilter.type = null; }
      renderLeftFilters(); renderTree();
    }
  );
  renderFilterRow(
    document.getElementById('left-filter-type'),
    App.store.type_list || [],           // 全域清單
    App.leftFilter.type,
    val => {
      App.leftFilter.type = val;
      if (val !== null) { App.leftFilter.category = null; App.leftFilter.location = null; }
      renderLeftFilters(); renderTree();
    }
  );
}

/** 預留：將來放病患其他報告的篩選器 */
function renderRightFilters() {
  // 目前清空，待後續功能實作
}

/* ─────────────────────────────────────────────
   過濾邏輯
   ───────────────────────────────────────────── */

/**
 * 判斷模板是否在目前篩選條件下可見。
 * 部位/型態皆為嚴格比對：template.location / template.type 必須包含篩選值。
 * 空陣列代表「未指定」，選了任何部位或型態篩選時不顯示。
 */
function isTemplateVisible(template, filter) {
  if (!template.active) return false;

  if (filter.location) {
    if (!template.location || !template.location.includes(filter.location)) return false;
  }

  if (filter.type) {
    if (!template.type || !template.type.includes(filter.type)) return false;
  }

  return true;
}

function isCategoryVisible(categoryName, templates, filter) {
  if (filter.category && filter.category !== categoryName) return false;
  if (filter.location || filter.type) {
    return templates.some(t => isTemplateVisible(t, filter));
  }
  return true;
}

/* ─────────────────────────────────────────────
   左側 Tree View
   ───────────────────────────────────────────── */
function renderTree() {
  const prof    = getCurrentProfile(App.store);
  const container = document.getElementById('template-tree');
  container.innerHTML = '';

  const ul = document.createElement('ul');

  (prof.category_list || []).forEach(cate => {
    const templates = (prof.category[cate] || []);
    if (!isCategoryVisible(cate, templates, App.leftFilter)) return;

    const li = document.createElement('li');
    li.className = 'tree-category open';

    // 類別標頭
    const header = document.createElement('div');
    header.className = 'tree-category-header';
    header.innerHTML = `<span class="tree-caret">▶</span><span>${cate}</span>`;
    header.addEventListener('click', () => {
      li.classList.toggle('open');
    });
    li.appendChild(header);

    // 模板列表
    const subUl = document.createElement('ul');
    subUl.className = 'tree-items';

    templates.forEach((tmpl, idx) => {
      if (!isTemplateVisible(tmpl, App.leftFilter)) return;

      const itemLi = document.createElement('li');

      // 檢查此模板是否有暫存狀態（病患 + profile + category + shortcut 為 key）
      const _draftPid = _getCurrentPatientId();
      const _hasDraftFlag = _hasDraft(_draftPid, App.store.current, cate, tmpl.shortcut || '');
      itemLi.className = 'tree-item'
        + (tmpl.active     ? '' : ' tree-item-inactive')
        + (_hasDraftFlag   ? ' tree-item-draft'    : '');
      itemLi.title = tmpl.description || tmpl.main.slice(0, 80);

      itemLi.innerHTML = `
        <span class="tree-item-shortcut">${tmpl.shortcut || '(無)'}</span>
        <span class="tree-item-desc">${tmpl.description || tmpl.main.slice(0, 40)}</span>
        <span class="tree-item-actions">
          <button class="tree-action-btn" data-action="edit" title="編輯">✎</button>
        </span>`;

      // 點選模板 → 插入（傳遞 _category 讓 options modal 能組出正確的 draft key）
      itemLi.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'edit') {
          openTemplateEditor({ category: cate, index: idx });
          return;
        }
        handleTemplateClick({ ...tmpl, _category: cate });
      });

      subUl.appendChild(itemLi);
    });

    li.appendChild(subUl);
    ul.appendChild(li);
  });

  const emptyMsg = ul.children.length === 0;
  if (emptyMsg) {
    const msg = document.createElement('div');
    msg.className = 'no-items-msg';
    msg.textContent = '沒有符合條件的模板';
    container.appendChild(msg);
  } else {
    container.appendChild(ul);
  }
}

/* ─────────────────────────────────────────────
   右側快速模板按鈕
   ───────────────────────────────────────────── */
/** 預留空白，將來放報告相關的快速按鈕 */
function renderQuickButtons() {
  document.getElementById('quick-template-buttons').innerHTML = '';
}

/* ─────────────────────────────────────────────
   Options Modal — 暫存功能（sessionStorage）
   ───────────────────────────────────────────── */

/**
 * 取得目前選取的病患 ID。
 * embed 模式下使用 URL 參數；獨立模式讀取病患輸入欄位。
 */
function _getCurrentPatientId() {
  if (_isEmbed) return _embedPatId || 'nobody';
  return (document.getElementById('patient-id')?.value?.trim()) || 'nobody';
}

/**
 * 產生 sessionStorage 的 draft key。
 * 格式：sr_draft|patientId|profileName|category|shortcut
 */
function _draftKey(patientId, profileName, category, shortcut) {
  return `sr_draft|${patientId}|${profileName}|${category}|${shortcut}`;
}

/** 是否存在暫存狀態 */
function _hasDraft(patientId, profileName, category, shortcut) {
  return !!sessionStorage.getItem(_draftKey(patientId, profileName, category, shortcut));
}

/**
 * 擷取 options-form 的當前選擇狀態。
 * - radios: { name → selectedValue }（只記錄有選到的群組）
 * - others: [{ t, v }]（checkbox / text / select，依 DOM 順序排列）
 */
function _captureFormState(form) {
  const radios = {};
  const others = [];
  form.querySelectorAll('input, select').forEach(el => {
    if (el.type === 'radio') {
      if (el.checked) radios[el.name] = el.value;
    } else if (el.type === 'checkbox') {
      others.push({ t: 'c', v: el.checked ? 1 : 0 });
    } else if (el.type === 'text') {
      others.push({ t: 'x', v: el.value });
    } else if (el.tagName === 'SELECT') {
      others.push({ t: 's', v: el.value });
    }
  });
  return { r: radios, o: others };
}

/**
 * 將暫存狀態回復至 options-form。
 * 回復後派發適當事件，觸發 compound widget 的 sync 更新。
 */
function _restoreFormState(form, state) {
  if (!state) return;

  // 還原 radio 群組（以 name 為 key 比對）
  Object.entries(state.r || {}).forEach(([name, value]) => {
    form.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(el => {
      if (el.value === value) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  // 還原 checkbox / text input / select（以 DOM 順序對應）
  const otherEls = [
    ...form.querySelectorAll('input[type="checkbox"], input[type="text"], select')
  ];
  (state.o || []).forEach((s, i) => {
    const el = otherEls[i];
    if (!el) return;
    if (s.t === 'c' && el.type === 'checkbox') {
      el.checked = !!s.v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (s.t === 'x' && el.type === 'text') {
      el.value = s.v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (s.t === 's' && el.tagName === 'SELECT') {
      el.value = s.v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

/**
 * 更新「暫存」按鈕的外觀與文字。
 * @param {boolean} hasDraft - 目前是否已有暫存
 */
function _updateOptionsDraftBtn(hasDraft) {
  const btn = document.getElementById('btn-options-draft');
  if (!btn) return;
  btn.classList.toggle('has-draft', hasDraft);
  btn.textContent = hasDraft ? '更新暫存' : '暫存';
}

/* ─────────────────────────────────────────────
   模板點選處理
   ───────────────────────────────────────────── */
function handleTemplateClick(template) {
  if (!template.active) return;
  if (hasDSLTokens(template.main)) {
    openOptionsModal(template);
  } else {
    insertTextAtCursor(App.activeTextarea, template.main);
  }
}

/* ─────────────────────────────────────────────
   插入報告
   ───────────────────────────────────────────── */
function insertTextAtCursor(textarea, text) {
  insertAtCursor(textarea || App.activeTextarea, text);
}

/* ─────────────────────────────────────────────
   模板選項 Modal
   ───────────────────────────────────────────── */
function openOptionsModal(template) {
  App.optionsTemplate = template;
  // 在 modal 奪取焦點前先儲存游標位置
  App.savedCursorPos = App.activeTextarea ? App.activeTextarea.selectionStart : 0;
  document.querySelector('.options-shortcut-label').textContent =
    (template.shortcut ? template.shortcut + ' — ' : '') + (template.description || '');

  const container = document.getElementById('options-form-container');
  container.innerHTML = '';
  const form = buildForm(template.main);
  form.id = 'options-form';
  container.appendChild(form);

  // 嘗試從 sessionStorage 還原暫存狀態
  const _pid      = _getCurrentPatientId();
  const _profName = App.store.current;
  const _rawDraft = sessionStorage.getItem(
    _draftKey(_pid, _profName, template._category || '', template.shortcut || '')
  );
  const _hasDraftNow = !!_rawDraft;
  if (_hasDraftNow) {
    try { _restoreFormState(form, JSON.parse(_rawDraft)); } catch (_) { /* 忽略解析錯誤 */ }
  }
  _updateOptionsDraftBtn(_hasDraftNow);

  openModal('options-modal');
}

function closeOptionsModal() {
  closeModal('options-modal');
  App.optionsTemplate = null;
}

/* ─────────────────────────────────────────────
   模板編輯器 Modal
   ───────────────────────────────────────────── */
function openTemplateEditor(ctx) {
  // ctx = { category, index } 編輯現有；null 或 {} 新增
  App.editCtx = ctx || null;
  const prof  = getCurrentProfile(App.store);

  // 填入類別下拉選單
  const catSel = document.getElementById('te-category');
  catSel.innerHTML = '';
  (prof.category_list || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catSel.appendChild(opt);
  });

  // 填入部位/型態 checkboxes（使用全域清單）
  renderTagCheckboxes('te-locations', App.store.locations_list || [], []);
  renderTagCheckboxes('te-types', App.store.type_list || [], []);

  let template = null;
  if (ctx && ctx.category !== undefined && ctx.index !== undefined) {
    template = prof.category[ctx.category]?.[ctx.index];
  }

  if (template) {
    document.getElementById('te-modal-title').textContent = '編輯模板';
    catSel.value = ctx.category;
    document.getElementById('te-shortcut').value    = template.shortcut || '';
    document.getElementById('te-description').value = template.description || '';
    document.getElementById('te-main').value        = template.main || '';
    document.getElementById('te-active').checked    = !!template.active;
    renderTagCheckboxes('te-locations', App.store.locations_list || [], template.location || []);
    renderTagCheckboxes('te-types', App.store.type_list || [], template.type || []);
    document.getElementById('btn-te-delete').classList.remove('hidden');
  } else {
    document.getElementById('te-modal-title').textContent = '新增模板';
    document.getElementById('te-shortcut').value    = '';
    document.getElementById('te-description').value = '';
    document.getElementById('te-main').value        = '';
    document.getElementById('te-active').checked    = true;
    document.getElementById('btn-te-delete').classList.add('hidden');
  }

  updateTemplatePreview();
  openModal('template-editor-modal');
}

function renderTagCheckboxes(containerId, items, selected) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach(item => {
    const lbl = document.createElement('label');
    lbl.className = 'tag-check-item';
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.value = item;
    inp.checked = selected.includes(item);
    const sp = document.createElement('span');
    sp.textContent = item;
    lbl.append(inp, sp);
    container.appendChild(lbl);
  });
}

function getCheckedTagValues(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' input:checked')).map(i => i.value);
}

function updateTemplatePreview() {
  const mainText = document.getElementById('te-main').value;
  const container = document.getElementById('te-preview-container');
  container.innerHTML = '';
  if (!mainText.trim()) {
    container.innerHTML = '<span class="no-items-msg">在左側輸入模板內容後預覽</span>';
    return;
  }
  try {
    const form = buildForm(mainText);
    container.appendChild(form);
  } catch (e) {
    container.innerHTML = '<span class="text-danger text-small">DSL 解析錯誤</span>';
  }
}

function saveTemplateFromEditor() {
  const shortcut  = document.getElementById('te-shortcut').value.trim();
  const mainText  = document.getElementById('te-main').value.trim();
  const category  = document.getElementById('te-category').value;
  const desc      = document.getElementById('te-description').value.trim();
  const active    = document.getElementById('te-active').checked;
  const location  = getCheckedTagValues('te-locations');
  const type      = getCheckedTagValues('te-types');

  if (!mainText) { showToast('請輸入模板內容', 'error'); return; }

  const template = { shortcut, main: mainText, description: desc, active, location, type };

  const profName = App.store.current;
  if (App.editCtx && App.editCtx.index !== undefined) {
    updateTemplate(App.store, profName, App.editCtx.category, App.editCtx.index, { ...template, category });
  } else {
    addTemplate(App.store, profName, category, template);
  }

  _closeTemplateEditorAndReturn();
  renderAll();
  showToast('模板已儲存', 'success');
}

function deleteTemplateFromEditor() {
  if (!App.editCtx) return;
  if (!confirm('確定要刪除這個模板嗎？')) return;
  deleteTemplate(App.store, App.store.current, App.editCtx.category, App.editCtx.index);
  App.tmSelectedIndex = null;   // 刪除後重設選取索引
  _closeTemplateEditorAndReturn();
  renderAll();
  showToast('模板已刪除');
}

/**
 * 關閉模板編輯器，若是從模板管理頁面進入的，自動重新開啟管理頁面。
 * 取代直接呼叫 closeModal('template-editor-modal')，確保使用者不會被踢出管理流程。
 */
function _closeTemplateEditorAndReturn() {
  closeModal('template-editor-modal');
  if (App._returnToManager) {
    App._returnToManager = false;
    // 刷新管理頁資料（類別 / 模板清單 / 按鈕狀態）後重新開啟
    renderTMCategories();
    renderTMTemplates();
    updateTMButtons();
    openModal('template-manager-modal');
  }
}

/* ─────────────────────────────────────────────
   模板管理 Modal (TM)
   ───────────────────────────────────────────── */
function openTemplateManager() {
  App.tmSelectedCate  = null;
  App.tmSelectedIndex = null;
  renderTMCategories();
  openModal('template-manager-modal');
}

function renderTMCategories() {
  const prof = getCurrentProfile(App.store);
  const ul   = document.getElementById('tm-category-list');
  ul.innerHTML = '';

  (prof.category_list || []).forEach(cate => {
    const li = document.createElement('li');
    li.className = 'tm-list-item' + (App.tmSelectedCate === cate ? ' selected' : '');
    li.innerHTML = `<span>${cate}</span><span class="text-muted text-small">(${(prof.category[cate] || []).length})</span>`;
    li.addEventListener('click', () => {
      App.tmSelectedCate  = cate;
      App.tmSelectedIndex = null;
      renderTMCategories();
      renderTMTemplates();
      updateTMButtons();
    });
    ul.appendChild(li);
  });
}

function renderTMTemplates() {
  const prof = getCurrentProfile(App.store);
  const ul   = document.getElementById('tm-template-list');
  ul.innerHTML = '';

  if (!App.tmSelectedCate) {
    ul.innerHTML = '<li class="no-items-msg">請先選擇類別</li>';
    return;
  }

  (prof.category[App.tmSelectedCate] || []).forEach((tmpl, idx) => {
    const li = document.createElement('li');
    li.className = 'tm-list-item' + (App.tmSelectedIndex === idx ? ' selected' : '') + (tmpl.active ? '' : ' tm-item-inactive');
    li.innerHTML = `<span class="tm-item-shortcut">${tmpl.shortcut || '—'}</span><span class="tm-item-desc">${tmpl.description || tmpl.main.slice(0, 50)}</span>`;
    li.addEventListener('click', () => {
      App.tmSelectedIndex = idx;
      renderTMTemplates();
      updateTMButtons();
    });
    ul.appendChild(li);
  });

  if (!ul.children.length) {
    ul.innerHTML = '<li class="no-items-msg">此類別沒有模板</li>';
  }
}

function updateTMButtons() {
  const hasTemplate = App.tmSelectedIndex !== null;
  document.getElementById('btn-tm-edit').disabled   = !hasTemplate;
  document.getElementById('btn-tm-delete').disabled = !hasTemplate;
  document.getElementById('btn-tm-up').disabled     = !hasTemplate || App.tmSelectedIndex === 0;
  const prof = getCurrentProfile(App.store);
  const len  = App.tmSelectedCate ? (prof.category[App.tmSelectedCate] || []).length : 0;
  document.getElementById('btn-tm-down').disabled   = !hasTemplate || App.tmSelectedIndex >= len - 1;
}

/* ─────────────────────────────────────────────
   使用者管理 Modal
   ───────────────────────────────────────────── */
function openProfileManager() {
  renderProfileList();
  renderGlobalTagList('global-location-tags', App.store.locations_list, 'location');
  renderGlobalTagList('global-type-tags', App.store.type_list, 'type');
  openModal('profile-modal');
}

/**
 * 渲染全域清單標籤（每個 tag 附刪除按鈕）
 * @param {string} containerId
 * @param {string[]} list
 * @param {'location'|'type'} kind
 */
function renderGlobalTagList(containerId, list, kind) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  list.forEach(name => {
    const span = document.createElement('span');
    span.className = 'global-tag';
    span.innerHTML = `${name}<button class="global-tag-del" data-kind="${kind}" data-name="${name}" title="刪除">×</button>`;
    container.appendChild(span);
  });
  // 事件委派（每次重繪後重新綁定）
  container.onclick = (e) => {
    const btn = e.target.closest('.global-tag-del');
    if (!btn) return;
    const k    = btn.dataset.kind;
    const name = btn.dataset.name;
    if (k === 'location') {
      removeLocation(App.store, name);
      renderGlobalTagList('global-location-tags', App.store.locations_list, 'location');
      renderLeftFilters();
      renderRightFilters();
    } else {
      removeType(App.store, name);
      renderGlobalTagList('global-type-tags', App.store.type_list, 'type');
      renderLeftFilters();
      renderRightFilters();
    }
  };
}

function renderProfileList() {
  const ul = document.getElementById('profile-list');
  ul.innerHTML = '';

  Object.keys(App.store.profiles).forEach(name => {
    const li = document.createElement('li');
    li.className = 'profile-list-item' + (name === App.store.current ? ' current' : '');
    li.innerHTML = `
      <span class="profile-item-name">${name}${name === App.store.current ? ' ✓' : ''}</span>
      <span class="profile-item-actions">
        ${name !== App.store.current ? `<button class="btn btn-sm btn-outline" data-name="${name}" data-action="switch">切換</button>` : ''}
        ${Object.keys(App.store.profiles).length > 1 ? `<button class="btn btn-sm btn-danger" data-name="${name}" data-action="delete">刪除</button>` : ''}
      </span>`;
    ul.appendChild(li);
  });

  // 事件委派
  ul.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const name   = btn.dataset.name;
    const action = btn.dataset.action;
    if (action === 'switch') {
      switchProfile(App.store, name);
      resetFilters();
      renderAll();
      renderProfileList();
      showToast('已切換至：' + name, 'success');
    } else if (action === 'delete') {
      if (!confirm(`確定刪除使用者「${name}」？此操作無法復原。`)) return;
      deleteProfile(App.store, name);
      renderAll();
      renderProfileList();
      showToast('已刪除使用者：' + name);
    }
  };
}

function resetFilters() {
  App.leftFilter = { category: null, location: null, type: null };
}

/* ─────────────────────────────────────────────
   歷史報告 Modal
   ───────────────────────────────────────────── */
function openHistoryModal() {
  App.reports = loadReports();
  renderHistoryList('');
  openModal('history-modal');
}

function renderHistoryList(query) {
  const container = document.getElementById('history-list');
  container.innerHTML = '';
  const q = query.toLowerCase();
  const filtered = App.reports.filter(r =>
    !q ||
    (r.patient?.id?.toLowerCase().includes(q)) ||
    (r.patient?.name?.toLowerCase().includes(q))
  );

  if (!filtered.length) {
    container.innerHTML = '<div class="no-items-msg">沒有符合的報告記錄</div>';
    return;
  }

  filtered.forEach(report => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const preview = (report.sections?.findings || '').slice(0, 60).replace(/\n/g, ' ');
    div.innerHTML = `
      <div class="history-item-header">
        <span class="history-patient-id">${report.patient?.id || '—'}</span>
        <span class="history-patient-name">${report.patient?.name || ''}</span>
        <span class="history-date">${(report.patient?.examDate || report.createdAt || '').slice(0, 10)}</span>
        <span class="history-modality">${report.patient?.modality || ''}</span>
      </div>
      <div class="history-preview">${preview || '(無內容)'}</div>
      <div class="history-actions">
        <button class="btn btn-sm btn-primary" data-id="${report.id}" data-action="load">載入</button>
        <button class="btn btn-sm btn-danger"  data-id="${report.id}" data-action="delete">刪除</button>
      </div>`;
    container.appendChild(div);
  });

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id     = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'load') {
      const report = App.reports.find(r => r.id === id);
      if (report) loadReport(report);
      closeModal('history-modal');
    } else if (action === 'delete') {
      if (!confirm('確定刪除此報告？')) return;

      // 取得報告的病患 ID，刪除前先記錄
      const deletedReport = App.reports.find(r => r.id === id);
      const patientId = deletedReport?.patient?.id;

      removeReport(App.reports, id);
      syncPatientList();

      renderHistoryList(document.getElementById('history-search').value);
      showToast('報告已刪除');
    }
  };
}

function loadReport(report) {
  document.getElementById('patient-id').value    = report.patient?.id       || '';
  document.getElementById('patient-name').value  = report.patient?.name     || '';
  document.getElementById('exam-date').value     = report.patient?.examDate || '';
  document.getElementById('exam-modality').value = report.patient?.modality || 'PET/CT';

  const findingsTA = document.getElementById('report-findings');
  const commentsTA = document.getElementById('report-comments');
  findingsTA.value = report.sections?.findings || '';
  commentsTA.value = report.sections?.comments || '';

  // 載入後同步更新行號
  updateLineNumbers(findingsTA);
  updateLineNumbers(commentsTA);

  // 同步 History Note
  loadHistoryNoteForPatient(report.patient?.id || '');

  showToast('報告已載入', 'success');
}

/* ─────────────────────────────────────────────
   報告儲存
   ───────────────────────────────────────────── */
function saveCurrentReport() {
  const patientId = _normalizePatientId(document.getElementById('patient-id').value.trim()) || 'nobody';
  const patient = {
    id:        patientId,
    name:      document.getElementById('patient-name').value.trim(),
    examDate:  document.getElementById('exam-date').value,
    modality:  document.getElementById('exam-modality').value,
  };

  // 自動記住患者（'nobody' 為匿名預設，仍正常寫入）
  upsertPatient(App.patients, patient);

  const report = {
    id: genId(),
    profile: App.store.current,
    patient,
    sections: {
      findings:   document.getElementById('report-findings').value,
      comments:   document.getElementById('report-comments').value,
    }
  };

  upsertReport(App.reports, report);

  // ── 同步至 IndexedDB（供 content.js import 功能讀取）───────────────────────
  // background.js 統一管理 IDB，透過 sendMessage 更新，避免直接 open IDB 版本衝突。
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage &&
      patient.id && patient.id !== 'nobody' && patient.examDate) {
    chrome.runtime.sendMessage({
      type:      'save_report_to_idb',
      patientId: patient.id,
      examDate:  patient.examDate,
      sections:  report.sections,
    }, () => { if (chrome.runtime.lastError) { /* 靜默忽略 */ } });
  }

  showToast('報告已儲存', 'success');
}

/* ─────────────────────────────────────────────
   病患 ID Combobox（已存檔報告下拉）
   ───────────────────────────────────────────── */

/**
 * 顯示病患 dropdown。
 * 以 App.reports 為唯一來源，去重後列出有報告的病患，
 * 確保與歷史記錄完全同步——歷史空白則 dropdown 亦為空。
 */
function showPatientDropdown() {
  const ul = document.getElementById('patient-dropdown');
  ul.innerHTML = '';

  /* ── HIS 今日清單區塊（依狀態分組）─────────────────── */
  const STATUS_ORDER  = [2, 3, 5, 4];
  const STATUS_LABELS = { 2: '未報到', 3: '已報到', 5: '報告未完成', 4: '報告已完成' };

  if (App.deptPatients && App.deptPatients.length > 0) {
    // 將 patients 按 _statusCode 分組
    const groups = {};
    App.deptPatients.forEach(pt => {
      const code = pt._statusCode;
      if (!groups[code]) groups[code] = [];
      groups[code].push(pt);
    });

    // 各分組依預約時間由早到晚排序（預設順序）
    STATUS_ORDER.forEach(code => {
      if (!groups[code]) return;
      groups[code].sort((a, b) => {
        const ta = _hisPick(a, 'ReservationDateTime', 'ExamDateTime', 'AppointmentTime', 'ScheduleDateTime');
        const tb = _hisPick(b, 'ReservationDateTime', 'ExamDateTime', 'AppointmentTime', 'ScheduleDateTime');
        return ta.localeCompare(tb);
      });
    });

    // ── 拖曳狀態（closure 跨事件共享）
    let dragSrcEl    = null;
    let dragSrcCode  = null;
    let dragSrcIndex = null;

    STATUS_ORDER.forEach(code => {
      const list = groups[code];
      if (!list || list.length === 0) return;

      // 狀態標頭
      const hdr = document.createElement('li');
      hdr.className = 'pd-section-header pd-status-' + code;
      hdr.textContent = (STATUS_LABELS[code] || code) + '（' + list.length + '）';
      ul.appendChild(hdr);

      list.forEach((pt, ptIdx) => {
        const id   = _normalizePatientId(_hisPick(pt, 'MedicalNoteNo'));
        const name = _hisPick(pt, 'PatientName', 'patientName', 'Name');
        const date = _hisPick(pt, 'ReservationDate', 'ExamDate', 'ScheduleDate', 'examDate');
        const mod  = _hisPick(pt, 'ItemName', 'ExaminationName', 'OrderName', 'modality');

        const li = document.createElement('li');
        li.className = 'pd-dept-item pd-status-item-' + code;
        li.draggable = true;
        li.dataset.statusCode = code;
        li.dataset.ptIdx = ptIdx;

        li.innerHTML =
          `<span class="pd-drag-handle" title="拖曳排序">⠿</span>` +
          `<span class="pd-id">${id}</span>` +
          `<span class="pd-name">${name}</span>` +
          `<span class="pd-date">${date.slice(0, 10)}</span>` +
          `<span class="pd-mod">${mod}</span>`;

        // 點擊載入報告（拖曳把手不觸發）
        li.addEventListener('mousedown', (e) => {
          if (e.target.classList.contains('pd-drag-handle')) return;
          e.preventDefault();
          const report = App.reports.find(r => r.patient?.id === id);
          if (report) {
            loadReport(report);
          } else {
            // 尚無報告時退回僅填入欄位（理論上 handleDeptPatients 已預建，極少觸發）
            document.getElementById('patient-id').value   = id;
            document.getElementById('patient-name').value = name;
            if (date) document.getElementById('exam-date').value = date.slice(0, 10).replace(/\//g, '-');
          }
          hidePatientDropdown();
          renderTree(); // 更新暫存狀態的粉色標示
        });

        // ── 拖曳開始
        li.addEventListener('dragstart', (e) => {
          dragSrcEl    = li;
          dragSrcCode  = code;   // 閉包捕捉本 forEach 的 code
          dragSrcIndex = ptIdx;  // 閉包捕捉本 forEach 的 ptIdx
          e.dataTransfer.effectAllowed = 'move';
          // 延遲加 class，避免影響拖曳快照
          setTimeout(() => li.classList.add('pd-dragging'), 0);
        });

        // ── 拖曳結束（無論是否成功 drop）
        li.addEventListener('dragend', () => {
          li.classList.remove('pd-dragging');
          ul.querySelectorAll('.pd-drag-over').forEach(el => el.classList.remove('pd-drag-over'));
          dragSrcEl = null;
        });

        // ── 拖曳經過（僅允許同狀態組）
        li.addEventListener('dragover', (e) => {
          if (!dragSrcEl || dragSrcEl === li) return;
          if (parseInt(li.dataset.statusCode) !== dragSrcCode) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          ul.querySelectorAll('.pd-drag-over').forEach(el => el.classList.remove('pd-drag-over'));
          li.classList.add('pd-drag-over');
        });

        // ── 放下：重排並重繪 dropdown
        li.addEventListener('drop', (e) => {
          if (!dragSrcEl || dragSrcEl === li) return;
          if (parseInt(li.dataset.statusCode) !== dragSrcCode) return;
          e.preventDefault();

          const targetIdx = parseInt(li.dataset.ptIdx);
          const grp = groups[dragSrcCode];

          // 從原位置取出並插入目標位置
          const [moved] = grp.splice(dragSrcIndex, 1);
          const adjustedTarget = targetIdx > dragSrcIndex ? targetIdx - 1 : targetIdx;
          grp.splice(adjustedTarget, 0, moved);

          // 同步回 App.deptPatients（保留其他組的相對順序）
          App.deptPatients = [];
          STATUS_ORDER.forEach(c => { if (groups[c]) App.deptPatients.push(...groups[c]); });

          // 重繪 dropdown（保持開啟狀態）
          showPatientDropdown();
        });

        ul.appendChild(li);
      });
    });

  }

  /* ── 其他已儲存報告（不在今日 HIS 清單中的病人）────────────── */
  // 收集今日 HIS 清單的所有 ID，用於去重
  const hisIdSet = new Set(
    App.deptPatients
      .map(pt => _normalizePatientId(_hisPick(pt, 'MedicalNoteNo')))
      .filter(Boolean)
  );

  const patientMap = new Map();
  [...App.reports]
    .sort((a, b) => {
      const da = a.patient?.examDate || a.updatedAt || '';
      const db = b.patient?.examDate || b.updatedAt || '';
      if (da !== db) return da.localeCompare(db);
      return (a.updatedAt || '').localeCompare(b.updatedAt || '');
    })
    .forEach(r => {
      const id = r.patient?.id;
      // 排除已在 HIS 清單中顯示的病人（避免重複）
      if (id && !patientMap.has(id) && !hisIdSet.has(id)) patientMap.set(id, r);
    });

  if (patientMap.size === 0 && App.deptPatients.length === 0) {
    const li = document.createElement('li');
    li.className = 'pd-empty';
    li.textContent = '尚無儲存的報告';
    ul.appendChild(li);
  } else if (patientMap.size > 0) {
    // 只有存在非 HIS 病人時才顯示分隔標頭
    const sep = document.createElement('li');
    sep.className = 'pd-section-header';
    sep.textContent = '其他已儲存報告';
    ul.appendChild(sep);

    patientMap.forEach((latestReport, id) => {
      const p    = latestReport.patient || {};
      const date = (p.examDate || latestReport.updatedAt || '').slice(0, 10);

      const li = document.createElement('li');
      li.innerHTML =
        `<span class="pd-id">${id}</span>` +
        `<span class="pd-name">${p.name || ''}</span>` +
        `<span class="pd-date">${date}</span>` +
        `<span class="pd-mod">${p.modality || ''}</span>`;

      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        loadReport(latestReport);
        hidePatientDropdown();
        renderTree(); // 更新暫存狀態的粉色標示
      });

      ul.appendChild(li);
    });
  }

  ul.hidden = false;
  document.getElementById('btn-patient-dropdown').classList.add('open');
}

function hidePatientDropdown() {
  document.getElementById('patient-dropdown').hidden = true;
  document.getElementById('btn-patient-dropdown').classList.remove('open');
}

/** 初始化 combobox 事件（DOMContentLoaded 後呼叫一次） */
function initPatientCombobox() {
  const input  = document.getElementById('patient-id');
  const btn    = document.getElementById('btn-patient-dropdown');
  const ul     = document.getElementById('patient-dropdown');

  // 按鈕點擊：切換 dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!ul.hidden) {
      hidePatientDropdown();
    } else {
      showPatientDropdown();
      input.focus();
    }
  });

  // input 輸入時不過濾 dropdown，保持全部顯示

  // ---- ＋ 新增病患按鈕 ----
  document.getElementById('btn-add-patient').addEventListener('click', () => {
    const raw = input.value.trim();
    if (!raw) { showToast('請輸入病患資料', 'error'); return; }

    // 自動辨識 ID（純數字）與姓名：
    //   tokens 中，全為數字的視為 ID，其餘合併為姓名。
    //   若無純數字 token，第一個 token 作為 ID，其餘為姓名。
    const tokens = raw.split(/\s+/);
    const numIdx = tokens.findIndex(t => /^\d+$/.test(t));
    let id, name;
    if (numIdx >= 0) {
      id   = tokens[numIdx];
      name = tokens.filter((_, i) => i !== numIdx).join(' ');
    } else {
      // 無純數字：第一段為 ID，其餘為姓名
      id   = tokens[0];
      name = tokens.slice(1).join(' ');
    }

    const patient = {
      id,
      name,
      examDate:  document.getElementById('exam-date').value,
      modality:  document.getElementById('exam-modality').value,
    };

    // 填入欄位（saveCurrentReport 會從 DOM 讀取，需先填好）
    input.value = id;
    document.getElementById('patient-name').value = name;

    // 儲存一筆（空白）報告，讓病患正式進入清單
    saveCurrentReport();

    showToast(`已新增病患：${id}${name ? ' ' + name : ''}`, 'success');
    hidePatientDropdown();
  });

  // 點擊頁面其他處關閉
  document.addEventListener('click', (e) => {
    if (!document.getElementById('patient-id-wrap').contains(e.target)) {
      hidePatientDropdown();
    }
  });
}

/** 相容舊呼叫，保留函式名稱 */
function renderPatientDatalist() {
  // dropdown 改為即時生成，此函式保留空白以免舊呼叫出錯
}

/**
 * 啟動時同步：移除 App.patients 中沒有對應報告的殘留記錄。
 * 確保 patient list 與歷史記錄一致。
 */
function syncPatientList() {
  const reportPatientIds = new Set(App.reports.map(r => r.patient?.id).filter(Boolean));
  const before = App.patients.length;

  App.patients = App.patients.filter(p => reportPatientIds.has(p.id));

  if (App.patients.length !== before) {
    savePatients(App.patients);
  }

  // 歷史記錄為空時，清空病患欄位
  if (App.reports.length === 0) {
    document.getElementById('patient-id').value    = '';
    document.getElementById('patient-name').value  = '';
  }
}

/* ─────────────────────────────────────────────
   匯入 / 匯出
   ───────────────────────────────────────────── */
/**
 * 將所有已儲存的報告輸出為 Markdown 格式並下載為 .txt 檔案。
 * 每筆報告以病患 ID 為一級標題，依 updatedAt 由新到舊排序。
 */
function downloadAllReports() {
  if (App.reports.length === 0) {
    showToast('尚無儲存的報告', 'error');
    return;
  }

  // 依 updatedAt 由新到舊排序
  const sorted = [...App.reports].sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );

  const lines = [];

  sorted.forEach((report, idx) => {
    const id       = report.patient?.id       || '（無 ID）';
    const name     = report.patient?.name     || '';
    const date     = report.patient?.examDate || (report.updatedAt || '').slice(0, 10);
    const modality = report.patient?.modality || '';
    const findings = (report.sections?.findings || '').trim();
    const comments = (report.sections?.comments || '').trim();

    lines.push(`# ${id}`);
    if (name)     lines.push(`**姓名：** ${name}`);
    if (date)     lines.push(`**日期：** ${date}`);
    if (modality) lines.push(`**檢查類型：** ${modality}`);
    lines.push('');

    if (findings) {
      lines.push('## Findings');
      lines.push(findings);
      lines.push('');
    }
    if (comments) {
      lines.push('## Comments');
      lines.push(comments);
      lines.push('');
    }

    // 分隔線（最後一筆不加）
    if (idx < sorted.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });

  const content  = lines.join('\n');
  const blob     = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const today    = new Date().toISOString().slice(0, 10);
  a.href         = url;
  a.download     = `soloreport_${today}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`已下載 ${sorted.length} 筆報告`, 'success');
}

function importTemplates() {
  openJSONFile((data, filename) => {
    // 支援兩種格式：profile 物件 或 DEFAULT_TEMPLATE_DATA 格式
    let profileData = null;
    if (data.category_list && data.category) {
      profileData = data;
    } else if (data.profiles) {
      // 完整 store 格式
      const first = Object.values(data.profiles)[0];
      if (first) profileData = first;
    }

    if (!profileData) {
      showToast('不支援的 JSON 格式', 'error');
      return;
    }

    const name = prompt('為此匯入資料命名（使用者名稱）：', filename.replace(/\.json$/i, ''));
    if (!name) return;

    App.store.profiles[name] = profileData;
    saveStore(App.store);
    renderAll();
    showToast('匯入成功：' + name, 'success');
  });
}

function exportTemplates() {
  const prof = getCurrentProfile(App.store);
  downloadJSON(prof, App.store.current + '_templates.json');
}

/* ─────────────────────────────────────────────
   Modal 系統
   ───────────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.getElementById('modal-backdrop').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // 若沒有其他 modal 開著，隱藏 backdrop
  const anyOpen = document.querySelector('.modal.open');
  if (!anyOpen) document.getElementById('modal-backdrop').classList.remove('active');
}

/* ─────────────────────────────────────────────
   全域事件綁定
   ───────────────────────────────────────────── */
function bindGlobalEvents() {

  // ---- Profile 下拉切換 ----
  document.getElementById('profile-select').addEventListener('change', (e) => {
    switchProfile(App.store, e.target.value);
    resetFilters();
    renderAll();
  });

  // ---- Header 按鈕 ----
  document.getElementById('btn-manage-profiles').addEventListener('click', openProfileManager);
  document.getElementById('btn-manage-templates').addEventListener('click', openTemplateManager);
  document.getElementById('btn-import').addEventListener('click', importTemplates);
  document.getElementById('btn-export').addEventListener('click', exportTemplates);

  // ---- 左側新增模板 ----
  document.getElementById('btn-add-template').addEventListener('click', () => openTemplateEditor(null));

  // ---- Report 操作 ----
  document.getElementById('btn-download-reports').addEventListener('click', downloadAllReports);
  document.getElementById('btn-save-report').addEventListener('click', saveCurrentReport);
  document.getElementById('btn-report-history').addEventListener('click', openHistoryModal);
  document.getElementById('btn-clear-report').addEventListener('click', () => {
    if (App.activeTextarea && App.activeTextarea.value &&
        confirm('確定清除目前節的內容？')) {
      App.activeTextarea.value = '';
    }
  });
  document.getElementById('btn-copy-report').addEventListener('click', () => {
    const findings = document.getElementById('report-findings').value;
    const comments = document.getElementById('report-comments').value;
    const parts = [findings, comments].filter(Boolean);
    navigator.clipboard.writeText(parts.join('\n\n')).then(() => showToast('已複製到剪貼板', 'success'));
  });

  // ---- Report Tabs ----
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (!section) return;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      // 切換包裝層（editor-with-ln）的 active 狀態，而非直接切換 textarea
      document.querySelectorAll('.editor-with-ln').forEach(w => w.classList.remove('active'));
      btn.classList.add('active');
      const ta   = document.getElementById('report-' + section);
      const wrap = document.getElementById('editor-wrap-' + section);
      if (wrap) wrap.classList.add('active');
      App.currentSection = section;
      App.activeTextarea = ta;
      ta.focus();
    });
  });

  // 記錄 active textarea（點擊焦點）
  document.querySelectorAll('.report-textarea').forEach(ta => {
    ta.addEventListener('focus', () => { App.activeTextarea = ta; });
    ta.addEventListener('click', () => { App.activeTextarea = ta; });
  });

  // ---- 自動儲存 ----
  let _autosaveTimer = null;
  document.querySelectorAll('.report-textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      if (!document.getElementById('chk-autosave').checked) return;
      clearTimeout(_autosaveTimer);
      _autosaveTimer = setTimeout(() => {
        saveCurrentReport();
        showToast('已自動儲存', 'success');
      }, 1000);
    });
  });

  // patient-id 的自動填入由 initPatientCombobox() 的 dropdown mousedown 處理
  // 手動輸入病患 ID 後離開欄位時，更新暫存狀態的粉色標示
  document.getElementById('patient-id')?.addEventListener('change', () => renderTree());

  // ---- Options Modal ----

  // 暫存按鈕：將目前選擇狀態存入 sessionStorage
  document.getElementById('btn-options-draft').addEventListener('click', () => {
    const tmpl = App.optionsTemplate;
    if (!tmpl) return;
    const form = document.getElementById('options-form');
    if (!form) return;
    const pid      = _getCurrentPatientId();
    const profName = App.store.current;
    const key      = _draftKey(pid, profName, tmpl._category || '', tmpl.shortcut || '');
    sessionStorage.setItem(key, JSON.stringify(_captureFormState(form)));
    // 更新按鈕外觀
    _updateOptionsDraftBtn(true);
    const btn = document.getElementById('btn-options-draft');
    btn.textContent = '已暫存 ✓';
    setTimeout(() => { btn.textContent = '更新暫存'; }, 1200);
    // 同步更新樹狀列表的粉色標示
    renderTree();
  });

  document.getElementById('btn-options-insert').addEventListener('click', () => {
    if (!App.optionsTemplate) return;
    const form = document.getElementById('options-form');
    if (!form) return;
    const result = extractFormResult(form, App.optionsTemplate.main);
    const ta  = App.activeTextarea;
    const pos = App.savedCursorPos;

    // 插入後清除該模板的暫存狀態，並移除粉色標示
    const tmpl = App.optionsTemplate;
    const dkey = _draftKey(
      _getCurrentPatientId(), App.store.current,
      tmpl._category || '', tmpl.shortcut || ''
    );
    sessionStorage.removeItem(dkey);

    closeOptionsModal();
    // 還原焦點與游標位置，確保插入在正確位置
    if (ta) {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = pos;
    }
    insertTextAtCursor(ta, result);
    renderTree(); // 移除粉色標示
  });

  // ---- Template Editor Modal ----
  document.getElementById('te-main').addEventListener('input', () => {
    clearTimeout(App.previewTimer);
    App.previewTimer = setTimeout(updateTemplatePreview, 500);
  });
  document.getElementById('btn-te-preview-refresh').addEventListener('click', updateTemplatePreview);
  document.getElementById('btn-te-save').addEventListener('click', saveTemplateFromEditor);
  document.getElementById('btn-te-delete').addEventListener('click', deleteTemplateFromEditor);

  document.getElementById('btn-te-add-cate').addEventListener('click', () => {
    const name = prompt('新類別名稱：');
    if (!name) return;
    addCategory(App.store, App.store.current, name);
    // 刷新類別選單
    const catSel = document.getElementById('te-category');
    const newOpt = document.createElement('option');
    newOpt.value = name;
    newOpt.textContent = name;
    catSel.appendChild(newOpt);
    catSel.value = name;
    renderLeftFilters();
    renderRightFilters();
    renderTree();
  });

  // ---- Template Manager Modal ----
  document.getElementById('btn-tm-add-cate').addEventListener('click', () => {
    const name = prompt('新類別名稱：');
    if (!name) return;
    addCategory(App.store, App.store.current, name);
    renderTMCategories();
    renderAll();
  });
  document.getElementById('btn-tm-add-template').addEventListener('click', () => {
    App._returnToManager = true;   // 關閉編輯器後自動返回管理頁
    closeModal('template-manager-modal');
    openTemplateEditor(App.tmSelectedCate ? { category: App.tmSelectedCate } : null);
  });
  document.getElementById('btn-tm-edit').addEventListener('click', () => {
    if (App.tmSelectedCate === null || App.tmSelectedIndex === null) return;
    App._returnToManager = true;   // 關閉編輯器後自動返回管理頁
    closeModal('template-manager-modal');
    openTemplateEditor({ category: App.tmSelectedCate, index: App.tmSelectedIndex });
  });
  document.getElementById('btn-tm-delete').addEventListener('click', () => {
    if (App.tmSelectedCate === null || App.tmSelectedIndex === null) return;
    if (!confirm('確定刪除此模板？')) return;
    deleteTemplate(App.store, App.store.current, App.tmSelectedCate, App.tmSelectedIndex);
    App.tmSelectedIndex = null;
    renderTMCategories();
    renderTMTemplates();
    updateTMButtons();
    renderAll();
    showToast('模板已刪除');
  });
  document.getElementById('btn-tm-up').addEventListener('click', () => {
    if (App.tmSelectedIndex === null) return;
    moveTemplate(App.store, App.store.current, App.tmSelectedCate, App.tmSelectedIndex, 'up');
    App.tmSelectedIndex--;
    renderTMCategories();
    renderTMTemplates();
    updateTMButtons();
    renderAll();
  });
  document.getElementById('btn-tm-down').addEventListener('click', () => {
    if (App.tmSelectedIndex === null) return;
    moveTemplate(App.store, App.store.current, App.tmSelectedCate, App.tmSelectedIndex, 'down');
    App.tmSelectedIndex++;
    renderTMCategories();
    renderTMTemplates();
    updateTMButtons();
    renderAll();
  });

  // ---- Profile Manager Modal ----
  document.getElementById('btn-create-profile').addEventListener('click', () => {
    const name = document.getElementById('new-profile-name').value.trim();
    if (!name) { showToast('請輸入名稱', 'error'); return; }
    if (!createProfile(App.store, name)) {
      showToast('名稱已存在', 'error');
      return;
    }
    document.getElementById('new-profile-name').value = '';
    renderProfileList();
    renderProfileSelect();
    showToast('已建立：' + name, 'success');
  });

  // 新增全域部位
  document.getElementById('btn-add-location').addEventListener('click', () => {
    const name = document.getElementById('new-location-name').value.trim();
    if (!name) return;
    if (!addLocation(App.store, name)) { showToast('部位已存在', 'error'); return; }
    document.getElementById('new-location-name').value = '';
    renderGlobalTagList('global-location-tags', App.store.locations_list, 'location');
    renderLeftFilters();
    renderRightFilters();
    showToast('已新增部位：' + name, 'success');
  });
  document.getElementById('new-location-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-add-location').click();
  });

  // 新增全域型態
  document.getElementById('btn-add-type').addEventListener('click', () => {
    const name = document.getElementById('new-type-name').value.trim();
    if (!name) return;
    if (!addType(App.store, name)) { showToast('型態已存在', 'error'); return; }
    document.getElementById('new-type-name').value = '';
    renderGlobalTagList('global-type-tags', App.store.type_list, 'type');
    renderLeftFilters();
    renderRightFilters();
    showToast('已新增型態：' + name, 'success');
  });
  document.getElementById('new-type-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-add-type').click();
  });

  // ---- History Modal ----
  document.getElementById('history-search').addEventListener('input', (e) => {
    renderHistoryList(e.target.value);
  });

  document.getElementById('btn-clear-all-reports').addEventListener('click', () => {
    if (!App.reports.length) { showToast('沒有可清除的報告', 'error'); return; }
    if (!confirm('確定要清除所有歷史報告？此操作無法復原。')) return;
    App.reports.length = 0;
    saveReports(App.reports);
    App.patients.length = 0;
    savePatients(App.patients);
    syncPatientList();
    renderHistoryList('');
    showToast('已清除所有報告', 'success');
  });

  // ---- Modal 關閉按鈕（含 backdrop）----
  // template-editor-modal 需透過 _closeTemplateEditorAndReturn() 關閉，
  // 確保從模板管理進入時，關閉後能自動返回管理頁。
  function _closeModalById(id) {
    if (id === 'template-editor-modal') {
      _closeTemplateEditorAndReturn();
    } else {
      closeModal(id);
    }
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => _closeModalById(btn.dataset.closeModal));
  });

  document.getElementById('modal-backdrop').addEventListener('click', () => {
    const open = document.querySelector('.modal.open');
    if (open) _closeModalById(open.id);
  });

  // ESC 關閉最頂層 Modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal.open');
      if (open) _closeModalById(open.id);
    }
  });
}

/* ─────────────────────────────────────────────
   行號（Line Numbers）
   ───────────────────────────────────────────── */

/**
 * 共用 Canvas 2D Context，用於量測 textarea 文字的實際像素寬度。
 * 透過比對 textarea 的 font 設定來決定是否需要更新 ctx.font。
 */
const _lnMeasure = (() => {
  const ctx      = document.createElement('canvas').getContext('2d');
  let   lastFont = '';
  return {
    setFont(font) { if (font !== lastFont) { ctx.font = font; lastFont = font; } },
    width(text)   { return ctx.measureText(text).width; }
  };
})();

/**
 * 更新指定 textarea 的行號欄。
 *
 * 計算方式：
 *   1. 以 Canvas measureText 量測每一邏輯行（\n 分隔）的實際像素寬度。
 *   2. 除以 textarea 的「可用文字寬度」（clientWidth − padding），
 *      得出該行在視覺上佔幾個折行列（visualRows）。
 *   3. 行號 div 的高度設為 visualRows × lineHeightPx，
 *      使其與 textarea 中對應的視覺列對齊。
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {boolean} [scrollOnly=false]
 *   true → 僅同步 scrollTop，不重繪行號（供 scroll 事件使用）
 */
function updateLineNumbers(textarea, scrollOnly) {
  const lnColId = 'ln-' + textarea.id.replace('report-', '');
  const lnCol   = document.getElementById(lnColId);
  if (!lnCol) return;

  // ── 僅同步捲軸（scroll 事件路徑）────────────────────────
  if (scrollOnly) {
    lnCol.scrollTop = textarea.scrollTop;
    return;
  }

  // ── 計算 textarea 可用寬度 ────────────────────────────────
  const taStyle      = window.getComputedStyle(textarea);
  const padLeft      = parseFloat(taStyle.paddingLeft)  || 0;
  const padRight     = parseFloat(taStyle.paddingRight) || 0;
  const contentWidth = textarea.clientWidth - padLeft - padRight;

  // 版面尚未完成時（clientWidth = 0）先跳過
  if (contentWidth <= 0) { lnCol.scrollTop = textarea.scrollTop; return; }

  // ── 計算行高（px）────────────────────────────────────────
  const lhRaw        = taStyle.lineHeight;
  const lineHeightPx = lhRaw === 'normal'
    ? parseFloat(taStyle.fontSize) * 1.2
    : parseFloat(lhRaw);

  // ── 設定 Canvas 字型（與 textarea 完全相同）──────────────
  _lnMeasure.setFont(`${taStyle.fontSize} ${taStyle.fontFamily}`);

  // ── 快取：value 與寬度都沒改變時，只同步捲軸 ────────────
  // 用「邏輯行數|字元數|寬度」作為輕量 key（避免全文字串比對）
  const lines    = textarea.value.split('\n');
  const cacheKey = `${lines.length}|${textarea.value.length}|${Math.round(contentWidth)}`;
  if (lnCol._lnKey === cacheKey) {
    lnCol.scrollTop = textarea.scrollTop;
    return;
  }
  lnCol._lnKey = cacheKey;

  // ── 重新渲染行號 ─────────────────────────────────────────
  lnCol.innerHTML = '';
  const frag = document.createDocumentFragment();

  lines.forEach((line, i) => {
    // 量測該邏輯行的實際像素寬度
    // 空行用單空格量測（避免 width = 0 後 ceil 出錯）
    const lineWidthPx = _lnMeasure.width(line || ' ');
    // 該行佔幾個視覺列（至少 1）
    const visualRows  = Math.max(1, Math.ceil(lineWidthPx / contentWidth));

    const div = document.createElement('div');
    div.textContent = i + 1;
    // 超過 1 個視覺列時，拉高 div 讓行號對齊第一列
    if (visualRows > 1) {
      div.style.height     = (visualRows * lineHeightPx) + 'px';
      div.style.lineHeight = lineHeightPx + 'px';
    }
    frag.appendChild(div);
  });

  lnCol.appendChild(frag);
  lnCol.scrollTop = textarea.scrollTop;
}

/**
 * 初始化所有 report-textarea 的行號功能：
 * - 初始渲染
 * - input 事件：內容變動時重繪
 * - scroll 事件：僅同步 ln-col 捲動（不重繪）
 * - window resize 事件：折行寬度改變，觸發重繪
 */
function initLineNumbers() {
  document.querySelectorAll('.report-textarea').forEach(ta => {
    updateLineNumbers(ta);
    ta.addEventListener('input',  () => updateLineNumbers(ta));
    ta.addEventListener('scroll', () => updateLineNumbers(ta, true));
  });

  // 視窗縮放時 contentWidth 改變，需重繪所有 textarea 的行號
  window.addEventListener('resize', () => {
    document.querySelectorAll('.report-textarea').forEach(ta => {
      if (ta.closest('.editor-with-ln.active')) {
        // 清除快取 key，強制重新計算折行
        const lnColId = 'ln-' + ta.id.replace('report-', '');
        const lnCol   = document.getElementById(lnColId);
        if (lnCol) lnCol._lnKey = '';
        updateLineNumbers(ta);
      }
    });
  });
}

/* ─────────────────────────────────────────────
   Shortcut 快捷鍵監視
   ───────────────────────────────────────────── */

/**
 * 目前正在累積的 shortcut 緩衝區。
 * 使用者在 report textarea 連續輸入英文字母時累積；
 * 輸入 `\` 時嘗試比對模板；任何非字母按鍵則重置。
 */
let _shortcutBuf = '';

/**
 * 在目前 profile 的所有 category 中尋找符合 shortcut 的「啟用中」模板。
 * 比對不分大小寫；回傳第一個找到的模板物件，否則回傳 null。
 *
 * @param {string} shortcut
 * @returns {object|null}
 */
function findTemplateByShortcut(shortcut) {
  if (!shortcut) return null;
  const lower = shortcut.toLowerCase();
  const prof  = getCurrentProfile(App.store);
  for (const cate of (prof.category_list || [])) {
    const found = (prof.category[cate] || []).find(
      t => t.active && (t.shortcut || '').toLowerCase() === lower
    );
    if (found) return found;
  }
  return null;
}

/**
 * 初始化所有 report-textarea 的 shortcut 監視：
 *
 * 監聽規則：
 *  - 英文字母（a-z / A-Z）→ 加入緩衝區（轉小寫比對）
 *  - `\`（反斜線）        → 嘗試比對；比對成功時刪除已鍵入的 shortcut
 *                           文字並觸發模板；無論成功與否都重置緩衝區
 *  - 其他任何按鍵         → 重置緩衝區（包含數字、空白、標點、Enter 等）
 *  - blur / 失焦          → 重置緩衝區
 *
 * 觸發後：
 *  1. 以 preventDefault() 阻止 `\` 寫入 textarea
 *  2. 從游標前方刪除 shortcut 長度的字元
 *  3. 派發 input 事件（更新行號）
 *  4. 呼叫 handleTemplateClick()（有 DSL → 開 options modal；無 DSL → 直接插入）
 */
function initShortcutMonitor() {
  document.querySelectorAll('.report-textarea').forEach(ta => {
    ta.addEventListener('keydown', (e) => {
      const key = e.key;

      /* ── 觸發：反斜線 ── */
      if (key === '\\') {
        e.preventDefault();   // 不把 \ 寫入 textarea

        const matched = findTemplateByShortcut(_shortcutBuf);

        if (matched) {
          /* 刪除 textarea 中已鍵入的 shortcut 文字 */
          const count    = _shortcutBuf.length;
          const selStart = ta.selectionStart;
          const val      = ta.value;
          const newCaret = Math.max(0, selStart - count);
          ta.value = val.slice(0, newCaret) + val.slice(selStart);
          ta.selectionStart = ta.selectionEnd = newCaret;
          ta.dispatchEvent(new Event('input')); // 更新行號

          /* 更新 activeTextarea，確保插入位置正確 */
          App.activeTextarea = ta;

          /* 觸發模板（有 DSL → options modal；無 DSL → 直接插入）*/
          handleTemplateClick(matched);
        }

        _shortcutBuf = '';
        return;
      }

      /* ── 英文字母：累積緩衝 ── */
      if (/^[a-zA-Z]$/.test(key)) {
        _shortcutBuf += key.toLowerCase();
        // 超過最長可能 shortcut 長度時截斷，避免無限增長
        if (_shortcutBuf.length > 64) _shortcutBuf = _shortcutBuf.slice(-64);
        return;
      }

      /* ── 其他按鍵：重置 ── */
      _shortcutBuf = '';
    });

    /* 失去焦點時重置 */
    ta.addEventListener('blur', () => { _shortcutBuf = ''; });
  });
}

/* ─────────────────────────────────────────────
   My-Assist-V3 Extension 橋接層
   ───────────────────────────────────────────── */

/**
 * 訊息協議（雙向）：
 *   頁面 → Extension：window.postMessage({ source:'soloreport', type, payload }, '*')
 *                     + CustomEvent 'soloreport:message' on document
 *   Extension → 頁面：window.postMessage({ source:'my-assist-v3', type, payload }, '*')
 *                     + CustomEvent 'my-assist-v3:message' on document
 *
 * 握手流程：
 *   頁面發送 PING → 等待 PONG（3 秒逾時）→ 更新 UI 狀態
 */
const Bridge = {
  connected: false,
  _handlers: [],   // { type, fn }[]

  /**
   * 傳送訊息給 extension。
   * 優先使用 chrome.runtime（extension page 模式），
   * 否則退回 window.postMessage（standalone localhost 模式）。
   */
  send(type, payload = {}) {
    const msg = { source: 'soloreport', type, payload };
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // 以 editor_bridge 包裝，讓 background.js 能識別
      chrome.runtime.sendMessage({ type: 'editor_bridge', data: msg });
    } else {
      // Standalone 模式：postMessage + CustomEvent
      window.postMessage(msg, '*');
      document.dispatchEvent(new CustomEvent('soloreport:message', { detail: msg }));
    }
  },

  /** 登錄訊息接收 handler */
  on(type, fn) {
    this._handlers.push({ type, fn });
  },

  /** 內部：分派收到的訊息 */
  _dispatch(type, payload) {
    this._handlers
      .filter(h => h.type === type || h.type === '*')
      .forEach(h => h.fn(payload, type));
  }
};

/**
 * 初始化橋接：
 * 1. 監聽來自 extension 的訊息
 *    - Extension page 模式：chrome.runtime.onMessage（background 直接回訊）
 *    - Standalone 模式：window.postMessage / CustomEvent
 * 2. 發送 PING，等待 PONG 確認連線
 */
function initExtensionBridge() {
  const statusEl = document.getElementById('ext-status');
  const TIMEOUT_MS = 3000;
  let pingTimer = null;

  /* ---- 更新 UI 狀態 ---- */
  function setStatus(state) {  // 'connecting' | 'connected' | 'error' | ''
    statusEl.className = 'ext-status' + (state ? ' ' + state : '');
    const labels = { connecting: '連線中…', connected: '已連線', error: '未偵測到', '': 'My-Assist' };
    statusEl.querySelector('.ext-label').textContent = labels[state] ?? 'My-Assist';
  }

  /* ---- 統一處理收到的 extension 訊息 ---- */
  function handleIncoming(data) {
    if (!data || data.source !== 'my-assist-v3') return;

    if (data.type === 'PONG') {
      clearTimeout(pingTimer);
      Bridge.connected = true;
      setStatus('connected');
    }

    Bridge._dispatch(data.type, data.payload);
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    // Extension page 模式：
    //   - 'editor_bridge'      → background 主動推送（PONG、初次 pending 的 DEPT_PATIENTS）
    //   - 'dept_patients_result' → content script 廣播，extension page 可直接接收，
    //                             不需 background 轉發（架構對稱於 background 的接收方式）
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === 'editor_bridge') {
        handleIncoming(request.data);
      } else if (request.type === 'dept_patients_result') {
        // 直接從 content script 收到科室病人清單（editor 已就緒時的正常路徑）
        handleDeptPatients(request.data);
      }
    });
  } else {
    // Standalone 模式：postMessage
    window.addEventListener('message', (e) => { handleIncoming(e.data); });
    document.addEventListener('my-assist-v3:message', (e) => { handleIncoming(e.detail); });
  }

  /* ---- 登錄 DEPT_PATIENTS handler ---- */
  Bridge.on('DEPT_PATIENTS', (payload) => {
    handleDeptPatients(payload);
  });

  /* ---- 發送 PING ---- */
  setStatus('connecting');
  Bridge.send('PING');

  pingTimer = setTimeout(() => {
    if (!Bridge.connected) setStatus('error');
  }, TIMEOUT_MS);
}

/* ─────────────────────────────────────────────
   HIS 科室病人清單處理
   ───────────────────────────────────────────── */

/**
 * HIS 欄位名稱可能因 API 版本不同，以優先順序嘗試多個候選。
 */
function _hisPick(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return String(obj[k]);
  }
  return '';
}

/**
 * 將病歷號正規化為 8 位數字字串（不足時補前導零）。
 * 適用於手動輸入或舊版資料的補齊，確保比對一致。
 * 若傳入值含非數字字元則原樣返回（避免破壞英數混合 ID）。
 *
 * @param {string} id
 * @returns {string}
 */
function _normalizePatientId(id) {
  if (!id) return id;
  // 純數字才補齊，含英文字母的 ID 不處理
  if (/^\d+$/.test(id)) return id.padStart(8, '0');
  return id;
}

/**
 * 取得科室病人清單。
 *
 * Extension page 模式（chrome-extension:// URL）：
 *   直接透過 chrome.tabs + chrome.storage 查詢 HIS tab 並送出 get_dept_patients，
 *   與 background.js 的 _fetchDeptPatientsForEditor 邏輯相同，
 *   結果由 content script 以 chrome.runtime.sendMessage(dept_patients_result) 廣播回來，
 *   SoloReport 的 chrome.runtime.onMessage 直接接收，不需 background 中繼。
 *
 * Standalone 模式（localhost 開發）：
 *   改走 Bridge.send('FETCH_PATIENTS') 路徑（供開發測試用）。
 */
function requestDeptPatients() {
  const dateVal = document.getElementById('dept-date').value;  // YYYY-MM-DD
  if (!dateVal) { showToast('請選擇日期', 'error'); return; }

  // 轉為 HIS API 格式：YYYY/MM/DD  00:00
  const ymd    = dateVal.replace(/-/g, '/');
  const params = { startDate: ymd + '  00:00', endDate: ymd + '  23:59' };

  showToast('載入 ' + dateVal + ' 清單…', '');

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.storage) {
    // Extension page：直接送 get_dept_patients 給 HIS content script
    chrome.storage.local.get('set_token', (saved) => {
      const token = saved.set_token || '';
      chrome.tabs.query(
        { url: ['*://hisweb.skh.org.tw/*', '*://ns-hisweb.skh.org.tw/*'] },
        (hisTabs) => {
          if (!hisTabs || hisTabs.length === 0) {
            showToast('找不到 HIS 分頁，請先開啟 HIS', 'error');
            return;
          }
          // fire-and-forget：結果由 content script 透過 dept_patients_result 廣播回來
          chrome.tabs.sendMessage(
            hisTabs[0].id,
            { type: 'get_dept_patients', info: params, token },
            { frameId: 0 }
          );
        }
      );
    });
  } else {
    // Standalone 開發模式：透過 Bridge 轉發
    Bridge.send('FETCH_PATIENTS', params);
  }
}

/**
 * 收到 extension 推送的科室病人清單後：
 * 1. 存入 App.deptPatients
 * 2. 對每位尚未有報告的 HIS 病人，自動建立空白報告並加入清單
 *    （讓 dropdown 點擊後能直接 loadReport，報告內容後續再填寫）
 * 3. 更新 ext-status 顯示人數
 */
function handleDeptPatients(payload) {
  if (!payload || !Array.isArray(payload.patients)) return;

  App.deptPatients = payload.patients;
  const count = payload.count || payload.patients.length;

  // ── Debug：追蹤 ID 從收到到存檔的完整路徑 ──────────────────────────
  if (App.deptPatients.length > 0) {
    const sample = App.deptPatients[0];
    const rawIdVal = sample.MedicalNoteNo;
    console.log('[SoloReport][handleDeptPatients] 第一筆 keys:', Object.keys(sample));
    console.log('[SoloReport][handleDeptPatients] 第一筆 rawIdVal type=' + typeof rawIdVal + ' value=', rawIdVal);
    console.log('[SoloReport][handleDeptPatients] _hisPick 結果:', _hisPick(sample, 'MedicalNoteNo', 'MedicalRecordNo', 'PatientId', 'medicalNoteNo', 'patientNo'));
  }
  // ──────────────────────────────────────────────────────────────────────

  // 對每位尚未有報告的 HIS 病人，建立空白報告
  let added = 0;
  App.deptPatients.forEach(pt => {
    const rawId = _hisPick(pt, 'MedicalNoteNo');
    if (!rawId) {
      console.warn('[SoloReport][handleDeptPatients] 無法取得病患 ID，原始資料:', pt);
      return;
    }
    const id = _normalizePatientId(rawId);   // 補齊 8 位前導零
    if (App.reports.some(r => r.patient?.id === id)) return;  // 已有報告，略過

    const name    = _hisPick(pt, 'PatientName', 'patientName', 'Name');
    const rawDate = _hisPick(pt, 'ReservationDate', 'ExamDate', 'ScheduleDate', 'examDate');
    const mod     = _hisPick(pt, 'ItemName', 'ExaminationName', 'OrderName', 'modality');

    const patient = {
      id,
      name,
      examDate: rawDate.slice(0, 10).replace(/\//g, '-'),
      modality: mod,
    };
    upsertPatient(App.patients, patient);
    upsertReport(App.reports, {
      id:      genId(),
      profile: App.store.current,
      patient,
      sections: { findings: '', comments: '' },
    });
    added++;
  });

  if (added > 0) console.log('[SoloReport] 新增', added, '位 HIS 病人的空白報告');
  console.log('[SoloReport] 收到科室病人清單，共', count, '人');
  showToast('已載入今日 HIS 清單：' + count + ' 人', 'success');

  // 在 ext-status 旁顯示人數
  const statusEl = document.getElementById('ext-status');
  if (statusEl) {
    let badge = statusEl.querySelector('.ext-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'ext-count';
      statusEl.appendChild(badge);
    }
    badge.textContent = count + '人';
  }
}

/* ─────────────────────────────────────────────
   Markdown 渲染器（無外部依賴）
   ───────────────────────────────────────────── */

/** HTML 特殊字元跳脫 */
function _escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 行內格式（bold / italic / strike / link / inline-code）*/
function _inlineFormat(t) {
  return t
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/~~(.+?)~~/g,         '<del>$1</del>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/**
 * 簡易 Markdown → HTML 轉換器。
 * 支援：h1-h3、粗體、斜體、刪除線、連結、有序/無序清單、
 *       分隔線、引言（>）、圍欄程式碼區塊（```）、行內程式碼（`）、段落。
 *
 * @param {string} raw  Markdown 原文
 * @returns {string}    HTML 字串
 */
function _renderMarkdown(raw) {
  // ── Step 1：保護程式碼區塊（避免內容被後續規則處理）──
  const saved = [];
  const hold  = html => { saved.push(html); return `\x00${saved.length - 1}\x00`; };

  let t = raw;

  // 圍欄程式碼區塊 (``` ... ```)
  t = t.replace(/```(?:[\w-]*)?\n?([\s\S]*?)```/g, (_, code) =>
    hold(`<pre><code>${_escHtml(code.replace(/\n$/, ''))}</code></pre>`));

  // 行內程式碼 (`...`)
  t = t.replace(/`([^`\n]+)`/g, (_, code) =>
    hold(`<code>${_escHtml(code)}</code>`));

  // ── Step 2：跳脫其餘 HTML 特殊字元 ──
  t = _escHtml(t);

  // ── Step 3：行內格式 ──
  t = _inlineFormat(t);

  // ── Step 4：逐行處理區塊元素 ──
  const lines  = t.split('\n');
  const out    = [];
  let inUL = false, inOL = false, inBQ = false, inP = false;

  const flushP  = () => { if (inP)  { out.push('</p>');         inP  = false; } };
  const flushUL = () => { if (inUL) { out.push('</ul>');        inUL = false; } };
  const flushOL = () => { if (inOL) { out.push('</ol>');        inOL = false; } };
  const flushBQ = () => { if (inBQ) { out.push('</blockquote>'); inBQ = false; } };
  const flush   = () => { flushP(); flushUL(); flushOL(); flushBQ(); };

  for (const line of lines) {

    // 保留佔位符（程式碼區塊）
    if (/^\x00\d+\x00$/.test(line.trim())) {
      flush(); out.push(line.trim()); continue;
    }

    // 水平分隔線 (---, ***, ___)
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flush(); out.push('<hr>'); continue;
    }

    // 標題 (# ## ###)
    const hm = line.match(/^(#{1,3}) (.+)/);
    if (hm) {
      flush();
      const lvl = hm[1].length;
      out.push(`<h${lvl}>${hm[2]}</h${lvl}>`);
      continue;
    }

    // 引言 (> ...)
    const bq = line.match(/^> ?(.*)/);
    if (bq) {
      flushP(); flushUL(); flushOL();
      if (!inBQ) { out.push('<blockquote>'); inBQ = true; }
      out.push(bq[1] || '<br>'); continue;
    }

    // 無序清單 (- / * / +)
    const ulm = line.match(/^[-*+] (.+)/);
    if (ulm) {
      flushP(); flushOL(); flushBQ();
      if (!inUL) { out.push('<ul>'); inUL = true; }
      out.push(`<li>${ulm[1]}</li>`); continue;
    }

    // 有序清單 (1. 2. ...)
    const olm = line.match(/^\d+\. (.+)/);
    if (olm) {
      flushP(); flushUL(); flushBQ();
      if (!inOL) { out.push('<ol>'); inOL = true; }
      out.push(`<li>${olm[1]}</li>`); continue;
    }

    // 空行 → 段落斷行
    if (!line.trim()) {
      flush(); continue;
    }

    // 一般文字 → 段落
    flushUL(); flushOL(); flushBQ();
    if (!inP) { out.push('<p>'); inP = true; } else out.push('<br>');
    out.push(line);
  }
  flush();

  // ── Step 5：還原程式碼佔位符 ──
  let result = out.join('');
  result = result.replace(/\x00(\d+)\x00/g, (_, i) => saved[+i]);
  return result;
}

/* ─────────────────────────────────────────────
   History Note 側邊欄
   ───────────────────────────────────────────── */

/**
 * 載入指定病患的 History Note 至側邊欄。
 *
 * 讀取順序：
 *   1. 先從 localStorage 立即顯示（同步，避免空白閃爍）
 *   2. 再向 background script 查詢 IDB（非同步）
 *      若 IDB 有值則以 IDB 為準並回寫 localStorage，
 *      確保跨瀏覽器 session 的筆記不遺失。
 *
 * @param {string} patientId
 */
function loadHistoryNoteForPatient(patientId) {
  const ta    = document.getElementById('history-note-textarea');
  const label = document.getElementById('hn-patient-label');
  if (!ta) return;

  if (label) label.textContent = patientId || '';

  if (!patientId) { ta.value = ''; return; }

  // 1. localStorage 先行顯示
  ta.value = loadHistoryNote(patientId);

  // 2. IDB 非同步查詢（透過 background service worker）
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'get_history_note', patientId }, res => {
      if (chrome.runtime.lastError) return;   // extension context 失效時靜默略過
      if (!res?.ok) return;
      // IDB 有值且與 localStorage 不同 → 以 IDB 為準
      if (res.note && res.note !== ta.value) {
        ta.value = res.note;
        saveHistoryNote(patientId, res.note);  // 回寫 localStorage
      }
    });
  }
}

/**
 * History Note sidebar 開/關時，報告 textarea 的寬度會因 flex 重新分配而改變。
 * 等 layout reflow 完成（requestAnimationFrame）後，清除行號快取並重繪。
 */
function _refreshReportLineNumbers() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.report-textarea').forEach(ta => {
      const lnColId = 'ln-' + ta.id.replace('report-', '');
      const lnCol   = document.getElementById(lnColId);
      if (lnCol) lnCol._lnKey = '';   // 清除快取，強制重算
      updateLineNumbers(ta);
    });
  });
}

/**
 * 初始化 History Note 側邊欄：
 *  - 「History Note」按鈕切換側邊欄開關
 *  - 側邊欄內「✕」按鈕關閉
 *  - textarea input → debounce 1 s 自動儲存
 */
function initHistoryNotePanel() {
  const panel      = document.getElementById('history-note-panel');
  const toggleBtn  = document.getElementById('btn-history-note');
  const closeBtn   = document.getElementById('btn-hn-close');
  const previewBtn = document.getElementById('btn-hn-preview');
  const ta         = document.getElementById('history-note-textarea');
  const previewDiv = document.getElementById('hn-preview');
  const saveStatus = document.getElementById('hn-save-status');
  const modeLabel  = document.getElementById('hn-mode-label');

  if (!panel || !toggleBtn || !ta) return;

  let _isPreview = false;

  /* ── 預覽 / 原文切換 ── */
  function showPreview() {
    _isPreview = true;
    previewDiv.innerHTML = _renderMarkdown(ta.value);
    ta.hidden         = true;
    previewDiv.hidden = false;
    previewBtn.textContent = '📝 原文';
    previewBtn.classList.add('active');
    if (modeLabel) modeLabel.textContent = '預覽中';
  }

  function showEdit() {
    _isPreview = false;
    ta.hidden         = false;
    previewDiv.hidden = true;
    previewBtn.textContent = '👁 預覽';
    previewBtn.classList.remove('active');
    if (modeLabel) modeLabel.textContent = 'Markdown';
    ta.focus();
  }

  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      _isPreview ? showEdit() : showPreview();
    });
  }

  /* ── 開關切換 ── */
  /* ── 釘選 / 解除釘選三顆動作按鈕 ──────────────────────────────────
     History Note 開啟後 #report-editor-wrapper 寬度縮小一半，
     導致 #report-tabs 右側的按鈕左移。
     解決方式：開啟後以 requestAnimationFrame 捕捉按鈕的實際座標，
     並用 position:fixed 將其凍結在該位置；關閉時還原。
  ─────────────────────────────────────────────────────────────────── */
  const _actionBtnIds = ['btn-history-note', 'btn-clear-report', 'btn-copy-report'];

  function _pinActionButtons() {
    _actionBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      Object.assign(btn.style, {
        position: 'fixed',
        top:      r.top    + 'px',
        left:     r.left   + 'px',
        width:    r.width  + 'px',
        height:   r.height + 'px',
        margin:   '0',
        zIndex:   '200',
      });
    });
  }

  function _unpinActionButtons() {
    _actionBtnIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      ['position','top','left','width','height','margin','zIndex'].forEach(p => {
        btn.style[p] = '';
      });
    });
  }

  function openPanel() {
    panel.classList.add('open');
    toggleBtn.classList.add('active');
    const pid = document.getElementById('patient-id').value.trim();
    loadHistoryNoteForPatient(pid);
    // 開啟時回到編輯模式
    showEdit();
    // sidebar 展開後報告欄位寬度縮小，需重算行號
    _refreshReportLineNumbers();
    // layout 穩定後釘選按鈕位置
    requestAnimationFrame(() => requestAnimationFrame(_pinActionButtons));
  }

  function closePanel() {
    // 先解除釘選，再移除 open class（還原 layout 流）
    _unpinActionButtons();
    panel.classList.remove('open');
    toggleBtn.classList.remove('active');
    // sidebar 關閉後報告欄位寬度恢復，需重算行號
    _refreshReportLineNumbers();
  }

  toggleBtn.addEventListener('click', () => {
    panel.classList.contains('open') ? closePanel() : openPanel();
  });

  if (closeBtn) closeBtn.addEventListener('click', closePanel);

  /* ── 視窗縮放時重新釘選按鈕座標 ── */
  window.addEventListener('resize', () => {
    if (panel.classList.contains('open')) {
      _unpinActionButtons();
      requestAnimationFrame(() => requestAnimationFrame(_pinActionButtons));
    }
  });

  /* ── 自動儲存（debounce 1 s）── */
  let _hnTimer = null;
  ta.addEventListener('input', () => {
    const pid = document.getElementById('patient-id').value.trim();
    if (!pid || pid === 'nobody') return;

    if (saveStatus) { saveStatus.textContent = ''; saveStatus.className = 'hn-save-status'; }

    clearTimeout(_hnTimer);
    _hnTimer = setTimeout(() => {
      // 1. localStorage（同步，立即）
      saveHistoryNote(pid, ta.value);
      // 2. IDB（非同步，透過 background service worker）
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'save_history_note', patientId: pid, note: ta.value },
          () => { if (chrome.runtime.lastError) { /* 靜默略過 */ } }
        );
      }
      if (saveStatus) {
        saveStatus.textContent = '已儲存';
        saveStatus.className   = 'hn-save-status saved';
        setTimeout(() => {
          saveStatus.textContent = '';
          saveStatus.className   = 'hn-save-status';
        }, 2000);
      }
    }, 1000);
  });
}
