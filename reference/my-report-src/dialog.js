/*global chrome*/
var origin   = {};
var tab_id   = 0;
var frame_id = 0;

var _data = {
  templates: {},
  current:  '',
  main:     '',
  cate:     '',
  shortcut: ''
};

// re, regexp, seper_pair are already declared in makeOption.js (loaded before this file)
const re_test = /G\d{.+?}|P{.+?}|M.?{.+?}|m.?{.+?}|H{.+?}|h{.+?}|V{.+?}|v{.+?}|L{.+?}|C{.+?}|c{.+?}|#{.+?}/;

// Detect if we are running inside an iframe (content-script injection)
// vs. a standalone popup window (call_tree / open_dialog path).
const _inIframe = (window.parent !== window);

// ── Profile combobox ──────────────────────────────────────────────────────────
const profileSel = document.getElementById('profile-select');

function renderProfileSelect() {
  const prev = profileSel.value;
  profileSel.innerHTML = '';
  Object.keys(_data.templates).forEach(function(name) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    profileSel.appendChild(opt);
  });
  // Restore previous selection if still valid, otherwise use _data.current
  if (_data.templates[prev]) {
    profileSel.value = prev;
  } else {
    profileSel.value = _data.current || Object.keys(_data.templates)[0] || '';
    _data.current = profileSel.value;
  }
}

profileSel.addEventListener('change', function() {
  _data.current = profileSel.value;
  renderTree();
});

// ── Tree ──────────────────────────────────────────────────────────────────────
function renderTree() {
  const container = document.getElementById('tree-container');
  container.innerHTML = '';
  const myJson = _data.templates[_data.current];
  if (!myJson) return;
  const tree = buildTree(myJson, handleClickOpen);
  container.appendChild(tree);
}

// ── Selector dialog ───────────────────────────────────────────────────────────
function showSelectorDialog() {
  const formContainer = document.getElementById('form-container');
  formContainer.innerHTML = '';
  if (_data.main) {
    const form = buildForm(_data.main);
    formContainer.appendChild(form);
  }
  document.getElementById('selector-dialog').showModal();
}

function handleClickOpen(main, cate, shortcut) {
  if (!re_test.test(main)) {
    sendResult(main, shortcut);
  } else {
    _data.main     = main;
    _data.cate     = cate;
    _data.shortcut = shortcut;
    showSelectorDialog();
  }
}

// ── Result delivery ───────────────────────────────────────────────────────────
// In iframe mode  → postMessage to parent content script
// In popup mode   → chrome.tabs.sendMessage to the content page
function sendResult(text, shortcut) {
  const sc      = shortcut || _data.shortcut;
  const re_from = (origin && origin.re_from) ? origin.re_from : 'content';

  if (_inIframe) {
    window.parent.postMessage({
      type:     'dialog_result',
      text:     text,
      shortcut: sc,
      re_from:  re_from
    }, '*');
    return;
  }

  // Popup window mode
  if (!tab_id) return;
  if (frame_id === -1) {
    chrome.tabs.sendMessage(tab_id, {
      type: 'insert_text',
      info: { Text: text },
      origin: origin
    });
  } else if (re_from === 'in_process') {
    chrome.tabs.sendMessage(tab_id, {
      type: 'in_process_text',
      info: { Text: text, shortcut: sc },
      origin: origin
    }, { frameId: frame_id });
  } else {
    chrome.tabs.sendMessage(tab_id, {
      type: 'replace_text',
      info: { Text: text, shortcut: sc },
      origin: origin
    }, { frameId: frame_id });
  }
}

// ── Close ─────────────────────────────────────────────────────────────────────
function handleClose() {
  if (_inIframe) {
    window.parent.postMessage({ type: 'dialog_close' }, '*');
    return;
  }
  chrome.runtime.sendMessage({ type: 'return_tab', origin: origin });
  window.close();
}

// ── Form submit ───────────────────────────────────────────────────────────────
function handleSubmit() {
  const re_block = /block\[(\d+)\]/g;
  const myForm   = document.getElementById('main');
  if (!myForm) return;

  const data    = new FormData(myForm);
  const matches = [..._data.main.split(re)];
  var result    = {};

  for (var pair of data.entries()) {
    if (pair[0].indexOf('_') === -1) {
      if (pair[0] in result) result[pair[0]].push(pair[1]);
      else                   result[pair[0]] = [pair[1]];
    }
  }

  let temp = '';
  matches.forEach((item, index) => {
    if (regexp.test(item)) {
      if (index in result) {
        const type = item.split('{')[0];
        if (seper_pair.hasOwnProperty(type)) {
          temp += jointer(result[index], seper_pair[type]);
        } else {
          temp += jointer(result[index]);
        }
      }
    } else {
      temp += item;
    }
  });

  if (re_block.test(temp)) {
    const keys = Object.keys(result);
    temp = temp.replace(/block\[(\d+)\]/g, (match, sub_number) => {
      const block_index = keys[parseInt(sub_number, 10)];
      return block_index ? result[block_index] : match;
    });
  }

  document.getElementById('selector-dialog').close();
  sendResult(temp);

  if (!_inIframe) window.close();
}

// ── Edit dialog ───────────────────────────────────────────────────────────────
function editOpen() {
  document.getElementById('selector-dialog').close();
  document.getElementById('editext').value = _data.main;
  document.getElementById('edit-dialog').showModal();
}

function editSave() {
  const myEdit = document.getElementById('editext').value;
  _data.main   = myEdit;
  chrome.runtime.sendMessage({
    type:   'save_main',
    info:   _data,
    origin: 'dialog'
  }, function() {
    document.getElementById('edit-dialog').close();
    showSelectorDialog();
  });
}

// ── Button wiring ─────────────────────────────────────────────────────────────
document.getElementById('btn-ok').addEventListener('click', handleSubmit);
document.getElementById('btn-cancel').addEventListener('click', function() {
  document.getElementById('selector-dialog').close();
  // call_tree iframe: cancel goes back to tree view instead of closing the iframe
  if (_inIframe && _data.type === 'call_tree') return;
  handleClose();
});
document.getElementById('btn-edit').addEventListener('click', editOpen);
document.getElementById('btn-edit-cancel').addEventListener('click', function() {
  document.getElementById('edit-dialog').close();
  showSelectorDialog();
});
document.getElementById('btn-edit-save').addEventListener('click', editSave);

// ── Init: POPUP WINDOW mode (call_tree / open_dialog from popup.js) ───────────
// Receives messages from background via chrome.runtime.sendMessage
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (_inIframe) return;   // ignore when running as iframe

  chrome.storage.local.get(null, function(items) {
    if (request.type === 'sd_dialog') {
      origin   = request.origin;
      tab_id   = request.origin.active_tab_id;
      frame_id = request.origin.frame_id;
      request.info.templates = items.templates;
      request.info.current   = items.current;
      _data = request.info;
      renderProfileSelect();
      renderTree();
      showSelectorDialog();
    }
    if (request.type === 'call_tree') {
      origin   = request.origin;
      tab_id   = request.origin.active_tab_id;
      frame_id = request.origin.frame_id;
      request.info.templates = items.templates;
      _data = Object.assign(_data, request.info);
      renderProfileSelect();
      renderTree();
    }
  });
});

// ── Init: IFRAME mode (ask_main from content script) ─────────────────────────
// Receives init payload via postMessage from the parent content script
window.addEventListener('message', function(e) {
  if (!e.data || typeof e.data.type !== 'string') return;
  if (!_inIframe) return;   // only process when actually inside an iframe

  if (e.data.type === 'init_dialog') {
    const info = e.data.info   || {};
    const orig = e.data.origin || {};
    origin   = orig;
    tab_id   = orig.active_tab_id || 0;
    frame_id = orig.frame_id      || 0;

    chrome.storage.local.get(null, function(items) {
      info.templates = items.templates || {};
      info.current   = info.current || items.current || '';
      _data = Object.assign(_data, info);
      renderProfileSelect();
      renderTree();
      if (_data.main) showSelectorDialog();
    });
  }
});

// ── Handshake (iframe mode only) ──────────────────────────────────────────────
// Signal the parent content script that dialog.js is ready to receive init_dialog
if (_inIframe) {
  setTimeout(function() {
    window.parent.postMessage({ type: 'dialog_ready' }, '*');
  }, 0);
}
