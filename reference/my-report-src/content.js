/*global chrome*/
var in_process = "";

// ── Saved target for focus restoration ───────────────────────────────────────
var _saved_target  = null;
var _saved_shortcut = '';
var _pending_info  = null;

// ── Iframe overlay ────────────────────────────────────────────────────────────
function showDialogIframe(info, origin) {
  closeDialogIframe();                         // remove any existing overlay first

  // Remember the element that was focused when the shortcut fired
  var ae = document.activeElement;
  if (ae && (ae.nodeName === 'TEXTAREA' || ae.nodeName === 'INPUT')) {
    _saved_target = ae;
  }
  _pending_info = { info: info, origin: origin };

  // Semi-transparent full-screen backdrop
  var overlay = document.createElement('div');
  overlay.id = 'myereport-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'background:rgba(0,0,0,0.55)',
    'display:flex', 'align-items:center', 'justify-content:center'
  ].join(';');

  // The dialog iframe
  var iframe = document.createElement('iframe');
  iframe.id  = 'myereport-iframe';
  iframe.src = chrome.runtime.getURL('dialog.html');
  iframe.style.cssText = [
    'width:min(1024px,98vw)', 'height:min(750px,96vh)',
    'border:none', 'border-radius:8px',
    'box-shadow:0 20px 60px rgba(0,0,0,0.5)'
  ].join(';');

  // Click on backdrop (not iframe) → close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeDialogIframe();
  });

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

function closeDialogIframe() {
  var overlay = document.getElementById('myereport-overlay');
  if (overlay) overlay.remove();
  if (_saved_target) {
    _saved_target.focus();
    _saved_target = null;
  }
  _saved_shortcut = '';
  _pending_info   = null;
}

// ── postMessage bridge (content ↔ dialog iframe) ─────────────────────────────
window.addEventListener('message', function(e) {
  if (!e.data || typeof e.data.type !== 'string') return;

  switch (e.data.type) {

    case 'dialog_ready': {
      // iframe finished loading — send the init payload
      var iframe = document.getElementById('myereport-iframe');
      if (iframe && _pending_info) {
        iframe.contentWindow.postMessage({
          type:   'init_dialog',
          info:   _pending_info.info,
          origin: _pending_info.origin
        }, '*');
      }
      break;
    }

    case 'dialog_result': {
      var text     = e.data.text;
      var shortcut = e.data.shortcut || _saved_shortcut;
      var re_from  = e.data.re_from  || 'content';

      var target = _saved_target || document.activeElement;
      closeDialogIframe();       // removes overlay, restores focus

      // Re-query after close in case closeDialogIframe changed activeElement
      if (!target || (target.nodeName !== 'TEXTAREA' && target.nodeName !== 'INPUT')) {
        target = document.activeElement;
      }

      if (target && (target.nodeName === 'TEXTAREA' || target.nodeName === 'INPUT')) {
        target.focus();
        if (re_from === 'in_process') {
          target.selectionStart = target.selectionEnd - 1;
          insertText(target, text);
        } else if (shortcut) {
          target.selectionStart = target.selectionEnd - shortcut.length - 1;
          insertText(target, text);
        } else {
          insertText(target, text);
        }
      }
      break;
    }

    case 'dialog_close':
      closeDialogIframe();
      break;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function trigger_change(_target) {
  var evt = document.createEvent('HTMLEvents');
  if (evt) {
    evt.initEvent('change', false, true);
    _target.dispatchEvent(evt);
  }
}

function insertText(target, text) {
  var startPosition = target.selectionStart;
  target.focus();
  if (!document.execCommand('insertText', false, text)) {
    target.setRangeText(text);
  }
  var the_end = startPosition + text.length;
  target.selectionStart = the_end;
  target.selectionEnd   = the_end;
  target.focus();
  trigger_change(target);
}

// ── Keyboard shortcut detector ────────────────────────────────────────────────
document.addEventListener('keydown', function(event) {
    console.log("get key");
  // Ctrl+Shift+Z → open tree dialog as inline iframe
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'Z' || event.key === 'z')) {
    event.preventDefault();
    console.log("get z")
    chrome.storage.local.get('current', function(item) {
      showDialogIframe(
        { current: item.current, type: 'call_tree' },
        { active_tab_id: 0, frame_id: 0, re_from: 'background' }
      );
    });
    return;
  }

  var clean_process = ['Backspace', 'Enter', 'Space'];
  if (event.code === 'Backslash' | event.key === '+' | event.code === 'NumpadAdd') {
    var active  = document.activeElement;
    var keyword = '';
    var re_word = /\b\b/g;
    if (active.nodeName === 'TEXTAREA' | active.nodeName === 'INPUT') {
      if (event.key !== 'Process' | event.code === 'NumpadAdd') {
        in_process = '';
        var startPosition = active.selectionStart;
        var text  = active.value;
        var begin = startPosition - 1;
        while (begin >= 0 && re_word.test(text.charAt(begin))) {
          keyword = text.charAt(begin) + keyword;
          begin--;
        }
        if (keyword) {
          // Save context for iframe result handling
          _saved_target   = active;
          _saved_shortcut = keyword;
          chrome.runtime.sendMessage({
            type: 'ask_main',
            info: { shortcut: keyword, re_from: 'content' },
            origin: 'content'
          });
        }
      } else if (in_process) {
        if (re_word.test(in_process)) {
          _saved_target   = active;
          _saved_shortcut = in_process;
          chrome.runtime.sendMessage({
            type: 'ask_main',
            info: { shortcut: in_process, re_from: 'in_process' },
            origin: 'in_process'
          });
        }
        in_process = '';
      } else {
        in_process = '';
      }
    }
  } else if (event.key === 'Process' && !clean_process.includes(event.code)) {
    if (event.getModifierState('CapsLock')) {
      in_process = in_process + event.code.charAt(event.code.length - 1);
    } else {
      in_process = in_process + event.code.charAt(event.code.length - 1).toLowerCase();
    }
  } else {
    in_process = '';
  }
});

// ── Messages from background ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  var active = document.activeElement;
  switch (request.type) {

    case 'show_dialog_iframe':
      showDialogIframe(request.info, request.origin);
      break;

    case 'insert_text':
      if (active.nodeName === 'TEXTAREA' | active.nodeName === 'INPUT') {
        insertText(active, request.info.Text);
        chrome.runtime.sendMessage({ type: 'return_tab', origin: request.origin });
      } else {
        console.log('target not found');
      }
      break;

    case 'replace_text':
      if (active.nodeName === 'TEXTAREA' | active.nodeName === 'INPUT') {
        active.selectionStart = active.selectionEnd - request.info.shortcut.length - 1;
        insertText(active, request.info.Text);
        if ('origin' in request) {
          chrome.runtime.sendMessage({ type: 'return_tab', origin: request.origin });
        }
      }
      break;

    case 'in_process_text':
      if (active.nodeName === 'TEXTAREA' | active.nodeName === 'INPUT') {
        active.selectionStart = active.selectionEnd - 1;
        insertText(active, request.info.Text);
        if ('origin' in request) {
          chrome.runtime.sendMessage({ type: 'return_tab', origin: request.origin });
        }
      }
      break;

    default:
      break;
  }
});
