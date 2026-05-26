/*global chrome*/
const the_default = {"version": "1.4",
"tab": {"TabName": {"Common": {"active": "True", "checklist": [], "connect": "Common"}},
    "List": ["Common"]},
"category_list": ["Common"], "category": {"Common": [{"shortcut": "lesion", "main": "V{+nodule|mass|lesion} with V{+mild increased|increased|intense} FDG uptake in the", "active": "True", "description": ""}]},
"Seeting": {"Send report by AHK": "True", "Adding line number when sending": "True", "Spelling check": "True"}};

const re = /G\d{.+?}|P{.+?}|M.?{.+?}|m.?{.+?}|H{.+?}|h{.+?}|V{.+?}|v{.+?}|L{.+?}|C{.+?}|c{.+?}|#{.+?}/;
initDataAndListener();

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(function(all_value){
    if (!all_value.hasOwnProperty("templates")) {
      console.log('installing data');
      install_default_data('/demo.json');
      console.log("local data created");
      return;
    }
    if (!all_value.hasOwnProperty("template_list")) {
      chrome.storage.local.set({"template_list":["default"]}, function(result){
        console.log(result);
      });
    }
    if (!all_value.hasOwnProperty("current")) {
      chrome.storage.local.set({"current":"default"}, function(result){
        console.log(result);
      });
    }
    if (!all_value.hasOwnProperty("seeting")) {
      chrome.storage.local.set({"seeting":{}}, function(result){
        console.log(result);
      });
    }
  });
});

function install_default_data(_file) {
  fetch(chrome.runtime.getURL(_file))
  .then((resp) => resp.json())
  .catch(error => {
    chrome.storage.local.set({
      "template_list":["default"],
      "templates":{"default":the_default},
      "current":"default",
      "seeting":{}
    }, function(result){
      console.log(result);
      console.log("Error: " + error);
    });
  })
  .then(function(jsonData) {
    if (!jsonData) return;
    chrome.storage.local.set({
      "template_list":["default"],
      "templates":{"default":jsonData},
      "current":"default",
      "seeting":{}
    }, function(result){
      console.log(result);
    });
  });
}

function save_main(_main, items) {
  let finded = false;
  if (items.templates.hasOwnProperty(_main.current)) {
    items.templates[_main.current]["category"][_main.cate].forEach((item, item_index) => {
      if (item.shortcut === _main.shortcut) {
        items.templates[_main.current]["category"][_main.cate][item_index] = _main;
        finded = true;
      }
    });
    if (finded) {
      chrome.storage.local.set({"templates":items.templates}, function(result){
        console.log('set: ' + result);
      });
    }
  }
  return finded;
}

function initDataAndListener() {
  console.log("initData");
  var origin = {current_win_id:0};

  var editor_tab_id = 0;
  var pop_win_id    = 0;   // popup window for call_tree (works on any tab)

  chrome.windows.onRemoved.addListener(function(windowId) {
    if (pop_win_id === windowId) pop_win_id = 0;
  });

  chrome.tabs.onRemoved.addListener(function(tabId) {
    if (editor_tab_id === tabId) editor_tab_id = 0;
  });

  chrome.commands.onCommand.addListener(function(command) {
    if (command === "call_editor") {
      if (editor_tab_id) {
        // 已開啟：切換焦點到那個 tab
        chrome.tabs.update(editor_tab_id, { active: true }, function(tab) {
          if (chrome.runtime.lastError) {
            // tab 已不存在，重新開
            editor_tab_id = 0;
            openEditorTab();
          } else {
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
      } else {
        openEditorTab();
      }
    }
  });

  function openEditorTab() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('editor.html'),
      active: true
    }, function(tab) {
      editor_tab_id = tab.id;
    });
  }

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
    origin = request.origin;
    chrome.storage.local.get(null, function(items){
      switch(request.type) {
        case 'open_dialog':
          // Triggered from popup.js — no content script available, use popup window
          pop_win_id = open_popup_dialog(pop_win_id, 'sd_dialog', request.info, request.origin);
          break;
        case 'ask_main': {
          let find_key = shortCuts(request.info.shortcut, items.templates, items.current);
          if (find_key) {
            if (re.test(find_key.main)) {
              // Triggered from content script — inject iframe directly in the page
              renew_dialog(0, 'sd_dialog', {
                current:  items.current,
                main:     find_key.main,
                cate:     find_key.cate,
                shortcut: find_key.shortcut,
              }, {
                active_tab_id:  sender.tab.id,
                frame_id:       sender.frameId,
                current_win_id: sender.tab.windowId,
                re_from:        request.info.re_from
              });
            } else {
              if (request.info.re_from === 'in_process') {
                chrome.tabs.sendMessage(sender.tab.id, {
                  type:'in_process_text',
                  info:{
                    Text:find_key.main,
                    shortcut:find_key.shortcut,
                    re_from:"in_process"
                  }}, {frameId:sender.frameId});
              } else {
                chrome.tabs.sendMessage(sender.tab.id, {
                  type:'replace_text',
                  info:{
                    Text:find_key.main,
                    shortcut:find_key.shortcut,
                    re_from:"background"
                  }}, {frameId:sender.frameId});
              }
            }
          }
          break;
        }
        case 'return_tab':
          chrome.windows.update(origin.current_win_id, {focused:true});
          break;
        case 'save_main': {
          let save_result = save_main(request.info, items);
          sendResponse(save_result);
          break;
        }
        default:
          break;
      }
    });
    return true;
  });
}

const shortCuts = (key, _templates, _current) => {
  let result;
  for (const [cate, value] of Object.entries(_templates[_current].category)) {
    result = value.find(item => item.shortcut === key);
    if (result) {
      result['cate'] = cate;
      return result;
    }
  }
  if (!result && _templates.hasOwnProperty('default')) {
    for (const [cate, value] of Object.entries(_templates['default'].category)) {
      result = value.find(item => item.shortcut === key);
      if (result) {
        result['cate'] = cate;
        return result;
      }
    }
  }
  return result;
};

// ── iframe path: ask_main from content script ─────────────────────────────────
// Sends show_dialog_iframe to the content script tab so it can inject an iframe.
function renew_dialog(_pop_win_id, _type, _info, _origin) {
  const tabId   = _origin && _origin.active_tab_id;
  const frameId = (_origin && typeof _origin.frame_id === 'number' && _origin.frame_id >= 0)
                  ? _origin.frame_id : 0;
  if (tabId) {
    chrome.tabs.sendMessage(
      tabId,
      {
        type:   'show_dialog_iframe',
        info:   Object.assign({}, _info, { type: _type }),
        origin: _origin
      },
      { frameId: frameId },
      function() {
        if (chrome.runtime.lastError) {
          console.log('iframe msg failed:', chrome.runtime.lastError.message);
        }
      }
    );
  }
  return 0;
}

// ── popup-window path: call_tree / open_dialog from popup.js ─────────────────
// Opens (or re-focuses) a dedicated popup window and sends a message to it.
function open_popup_dialog(_pop_win_id, _type, _info, _origin) {
  if (_pop_win_id) {
    chrome.runtime.sendMessage({ type: _type, info: _info, origin: _origin });
    chrome.windows.update(_pop_win_id, { focused: true });
    return _pop_win_id;
  }
  chrome.windows.create({
    url:    chrome.runtime.getURL('dialog.html'),
    width:  1024,
    height: 750,
    type:   'popup'
  }, function(win) {
    _pop_win_id = win.id;
    chrome.tabs.onUpdated.addListener(function listener(tabId, tabinfo) {
      if (tabinfo.status === 'complete' && tabId === win.tabs[0].id) {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.runtime.sendMessage({ type: _type, info: _info, origin: _origin });
      }
    });
  });
  return _pop_win_id;
}
