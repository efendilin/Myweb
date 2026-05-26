/*global chrome*/
var pop_win_id = 0;
var _data = { templates: {}, current: '' };
var init = false;

const re_test = /G\d{.+?}|P{.+?}|M.?{.+?}|m.?{.+?}|H{.+?}|h{.+?}|V{.+?}|v{.+?}|L{.+?}|C{.+?}|c{.+?}|#{.+?}/;

function renderProfileSelect() {
  const sel = document.getElementById('profile-select');
  const names = Object.keys(_data.templates);
  sel.innerHTML = '';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === _data.current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderTree() {
  const container = document.getElementById('tree-container');
  container.innerHTML = '';
  const myJson = _data.templates[_data.current];
  if (!myJson) return;
  const tree = buildTree(myJson, handleClickOpen);
  container.appendChild(tree);
}

function handleClickOpen(main, cate, shortcut) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!re_test.test(main)) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'insert_text',
        info: { Text: main, shortcut: shortcut, re_from: 'popup' }
      });
    } else {
      openDialog({
        current: _data.current,
        main: main,
        cate: cate,
        shortcut: shortcut
      }, {
        current_win_id: tabs[0].windowId,
        active_tab_id: tabs[0].id,
        frame_id: -1,
        arranged: true,
        re_from: 'popup'
      });
    }
  });
}

function openDialog(info, origin) {
  chrome.runtime.sendMessage({ type: 'open_dialog', info: info, origin: origin });
}

function openOptions() {
  chrome.runtime.getURL && chrome.windows.create({
    url: chrome.runtime.getURL('options.html'),
    width: 1024,
    height: 750,
    type: 'popup'
  });
}

document.getElementById('profile-select').addEventListener('change', function(e) {
  _data.current = e.target.value;
  chrome.storage.local.set({ current: e.target.value });
  renderTree();
});

document.getElementById('btn-options').addEventListener('click', openOptions);

// Load data from storage
chrome.storage.local.get(null, function(result) {
  if (!init) {
    init = true;
    _data = {
      templates: result.templates || {},
      current: result.current || ''
    };
    renderProfileSelect();
    renderTree();
  }
});
