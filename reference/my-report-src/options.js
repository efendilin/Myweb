/*global chrome*/
var _templates = {};
var _current = '';
var cate_checked = 0;
var temp_checked = 0;
var is_init = false;
var _edit_status = { cate_list: [], shortcut: '', main: '', cate: '' };

const re_word = /^[a-zA-Z0-9]+$/;

// ── Storage ──────────────────────────────────────────────────────────────
function save_profile(data) {
  chrome.storage.local.set({ templates: data });
}

// ── Render ───────────────────────────────────────────────────────────────
function renderProfileSelect() {
  const sel = document.getElementById('profile-select');
  const prev = sel.value;
  sel.innerHTML = '';
  Object.keys(_templates).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === _current) opt.selected = true;
    sel.appendChild(opt);
  });
  if (prev && _templates[prev]) sel.value = prev;
}

function renderCateList() {
  const box = document.getElementById('cate-list');
  box.innerHTML = '';
  const cate_list = getCateList();
  cate_list.forEach((cate, index) => {
    if (!cate) return;
    const item = document.createElement('div');
    item.className = 'list-item' + (index === cate_checked ? ' selected' : '');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'cate-radio';
    radio.checked = index === cate_checked;
    radio.addEventListener('change', () => { cate_checked = index; temp_checked = 0; renderCateList(); renderTempList(); });
    const txt = document.createElement('span');
    txt.className = 'list-item-text';
    txt.textContent = cate;
    const btns = document.createElement('div');
    btns.className = 'list-item-btns';
    const up = document.createElement('button');
    up.textContent = '▲';
    up.addEventListener('click', (e) => { e.stopPropagation(); arrage_data('cate', 'up', index); });
    const dn = document.createElement('button');
    dn.textContent = '▼';
    dn.addEventListener('click', (e) => { e.stopPropagation(); arrage_data('cate', 'down', index); });
    btns.appendChild(up);
    btns.appendChild(dn);
    item.appendChild(radio);
    item.appendChild(txt);
    item.appendChild(btns);
    item.addEventListener('click', () => { cate_checked = index; temp_checked = 0; renderCateList(); renderTempList(); });
    box.appendChild(item);
  });
}

function renderTempList() {
  const box = document.getElementById('temp-list');
  box.innerHTML = '';
  const cate_list = getCateList();
  const selected_cate = cate_list[cate_checked];
  if (!selected_cate || !_templates[_current]) return;
  const items = _templates[_current].category[selected_cate] || [];
  items.forEach((item, index) => {
    if (!item) return;
    const row = document.createElement('div');
    row.className = 'list-item' + (index === temp_checked ? ' selected' : '');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'temp-radio';
    radio.checked = index === temp_checked;
    radio.addEventListener('change', () => { temp_checked = index; renderTempList(); });
    const txt = document.createElement('span');
    txt.className = 'list-item-text';
    txt.textContent = item.shortcut;
    const btns = document.createElement('div');
    btns.className = 'list-item-btns';
    const up = document.createElement('button');
    up.textContent = '▲';
    up.addEventListener('click', (e) => { e.stopPropagation(); arrage_data('temp', 'up', index); });
    const dn = document.createElement('button');
    dn.textContent = '▼';
    dn.addEventListener('click', (e) => { e.stopPropagation(); arrage_data('temp', 'down', index); });
    btns.appendChild(up);
    btns.appendChild(dn);
    row.appendChild(radio);
    row.appendChild(txt);
    row.appendChild(btns);
    row.addEventListener('click', () => { temp_checked = index; renderTempList(); });
    box.appendChild(row);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function getCateList() {
  if (!_templates[_current]) return [];
  return _templates[_current].category_list || [];
}

function renderAll() {
  renderProfileSelect();
  renderCateList();
  renderTempList();
}

// ── CRUD ─────────────────────────────────────────────────────────────────
function arrage_data(which, direct, index) {
  const temp = _templates;
  const cate_list = temp[_current].category_list;
  const selected_cate = cate_list[cate_checked];
  if (which === 'cate') {
    const target = cate_list[index];
    if (direct === 'up') {
      if (index < 1) return;
      cate_list[index] = cate_list[index - 1];
      cate_list[index - 1] = target;
    } else {
      if (index >= cate_list.length - 1) return;
      cate_list[index] = cate_list[index + 1];
      cate_list[index + 1] = target;
    }
  } else {
    const items = temp[_current].category[selected_cate];
    const target_temp = items[index];
    if (direct === 'up') {
      if (index < 1) return;
      items[index] = items[index - 1];
      items[index - 1] = target_temp;
    } else {
      if (index >= items.length - 1) return;
      items[index] = items[index + 1];
      items[index + 1] = target_temp;
    }
  }
  save_profile(temp);
  renderCateList();
  renderTempList();
}

function add_category(cate) {
  if (_templates[_current].category[cate]) { alert('類別已存在'); return; }
  if (cate) {
    _templates[_current].category[cate] = [];
    _templates[_current].category_list.push(cate);
    save_profile(_templates);
    renderCateList();
    renderTempList();
  }
}

function change_category(cate) {
  if (_templates[_current].category[cate]) { alert('類別已存在'); return; }
  if (cate) {
    const old_cate = _templates[_current].category_list[cate_checked];
    _templates[_current].category[cate] = _templates[_current].category[old_cate];
    delete _templates[_current].category[old_cate];
    _templates[_current].category_list[cate_checked] = cate;
    save_profile(_templates);
    renderCateList();
    renderTempList();
  }
}

function editOpen(arr) {
  if (arr) _edit_status = arr;
  // populate cate select
  const cate_sel = document.getElementById('cate-select');
  cate_sel.innerHTML = '';
  _edit_status.cate_list.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === _edit_status.cate) opt.selected = true;
    cate_sel.appendChild(opt);
  });
  document.getElementById('shortcut-input').value = _edit_status.shortcut || '';
  document.getElementById('editext').value = _edit_status.main || '';
  document.getElementById('edit-dialog').showModal();
}

function editSave() {
  const mainVal = document.getElementById('editext').value;
  const shortcutVal = document.getElementById('shortcut-input').value;
  const cateVal = document.getElementById('cate-select').value;
  if (!mainVal || !shortcutVal || !re_word.test(shortcutVal)) {
    alert('Shortcut 只能使用英數字，且不能為空');
    return;
  }
  const selected_cate = getCateList()[cate_checked];
  const temp = _templates;
  if (_edit_status.shortcut) {
    // edit existing
    const target_item = temp[_current].category[selected_cate][temp_checked];
    if (target_item) {
      target_item.main = mainVal;
      target_item.shortcut = shortcutVal;
      if (cateVal !== selected_cate) {
        temp[_current].category[cateVal].push(target_item);
        temp[_current].category[selected_cate].splice(temp_checked, 1);
      } else {
        temp[_current].category[cateVal][temp_checked] = target_item;
      }
    }
  } else {
    // new template
    temp[_current].category[cateVal].push({
      shortcut: shortcutVal,
      main: mainVal,
      description: '',
      active: 'true'
    });
  }
  save_profile(temp);
  document.getElementById('edit-dialog').close();
  renderCateList();
  renderTempList();
}

function preview() {
  _edit_status.shortcut = document.getElementById('shortcut-input').value;
  _edit_status.main = document.getElementById('editext').value;
  _edit_status.cate = document.getElementById('cate-select').value;
  document.getElementById('edit-dialog').close();
  const container = document.getElementById('preview-form-container');
  container.innerHTML = '';
  if (_edit_status.main) {
    container.appendChild(buildForm(_edit_status.main));
  }
  document.getElementById('preview-dialog').showModal();
}

function loadfile(e) {
  const reader = new FileReader();
  const profilename = prompt('定義你的 profile 名稱:');
  if (!profilename) return;
  reader.onload = function(ev) {
    const result = JSON.parse(ev.target.result);
    _templates[profilename] = result;
    save_profile(_templates);
    _current = profilename;
    renderAll();
  };
  reader.readAsText(e.target.files[0]);
}

function del_profile(profile) {
  if (profile in _templates) {
    delete _templates[profile];
    save_profile(_templates);
    _current = Object.keys(_templates)[0] || '';
    renderAll();
  }
}

// ── Button wiring ─────────────────────────────────────────────────────────
document.getElementById('btn-nc').addEventListener('click', () => {
  const k = prompt('新類別名稱（英數字）:');
  if (!k) return;
  if (re_word.test(k)) add_category(k);
  else alert('只能使用英數字');
});

document.getElementById('btn-rc').addEventListener('click', () => {
  const k = prompt('新類別名稱（英數字）:');
  if (!k) return;
  if (re_word.test(k)) change_category(k);
  else alert('只能使用英數字');
});

document.getElementById('btn-dc').addEventListener('click', () => {
  const cate_list = getCateList();
  const target = cate_list[cate_checked];
  if (!target) return;
  const k = prompt('輸入要刪除的類別名稱確認:');
  if (k !== target) return;
  delete _templates[_current].category[k];
  _templates[_current].category_list.splice(cate_checked, 1);
  cate_checked = 0;
  save_profile(_templates);
  renderCateList();
  renderTempList();
});

document.getElementById('btn-nt').addEventListener('click', () => {
  const cate_list = getCateList();
  if (cate_checked >= cate_list.length) return;
  editOpen({
    cate_list: cate_list,
    shortcut: '',
    main: '',
    cate: cate_list[cate_checked]
  });
});

document.getElementById('btn-et').addEventListener('click', () => {
  const cate_list = getCateList();
  const selected_cate = cate_list[cate_checked];
  if (!selected_cate) return;
  const items = _templates[_current].category[selected_cate] || [];
  if (temp_checked >= items.length) return;
  editOpen({
    cate_list: cate_list,
    shortcut: items[temp_checked].shortcut,
    main: items[temp_checked].main,
    cate: selected_cate
  });
});

document.getElementById('btn-dt').addEventListener('click', () => {
  const cate_list = getCateList();
  const selected_cate = cate_list[cate_checked];
  if (!selected_cate) return;
  const items = _templates[_current].category[selected_cate] || [];
  if (temp_checked >= items.length) return;
  const k = prompt('輸入要刪除的 shortcut 確認:');
  if (k !== items[temp_checked].shortcut) return;
  _templates[_current].category[selected_cate].splice(temp_checked, 1);
  save_profile(_templates);
  renderTempList();
});

document.getElementById('btn-download').addEventListener('click', () => {
  download(_templates[_current], 'mytemplate.json');
});

document.getElementById('btn-upload').addEventListener('click', () => {
  openFileDialog('.json', loadfile);
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const k = prompt('輸入要刪除的 profile 名稱:');
  if (k) del_profile(k);
});

document.getElementById('profile-select').addEventListener('change', function(e) {
  _current = e.target.value;
  cate_checked = 0;
  temp_checked = 0;
  renderCateList();
  renderTempList();
});

document.getElementById('btn-edit-cancel').addEventListener('click', () => {
  document.getElementById('edit-dialog').close();
});
document.getElementById('btn-preview').addEventListener('click', preview);
document.getElementById('btn-edit-save').addEventListener('click', editSave);
document.getElementById('btn-preview-back').addEventListener('click', () => {
  document.getElementById('preview-dialog').close();
  editOpen(null);
});
document.getElementById('btn-preview-close').addEventListener('click', () => {
  document.getElementById('preview-dialog').close();
});

// ── Init ──────────────────────────────────────────────────────────────────
chrome.storage.local.get('templates', function(data) {
  if (!is_init && data.hasOwnProperty('templates')) {
    is_init = true;
    _templates = data.templates;
    _current = Object.keys(_templates)[0] || '';
    renderAll();
  }
});

chrome.storage.onChanged.addListener(function(changed, area) {
  if (area === 'local' && 'templates' in changed) {
    _templates = changed.templates.newValue;
    renderAll();
  }
});
