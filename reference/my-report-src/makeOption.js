// makeOption.js — vanilla JS form builder (ported from src/dialog/makeOption.js)
// Depends on utils.js (jointer, replace_plus must be loaded first)

const re = /(G\d{.+?}|P.?{.+?}|M.?{.+?}|m.?{.+?}|H{.+?}|h{.+?}|V{.+?}|v{.+?}|L{.+?}|C{.+?}|c{.+?}|#{.+?}|\r?\n)/;
const regexp = /(^G\d|^P|^M.?|^m.?|^H|^h|^V|^v|^L|^#|^C|^c){(.+?)}/;
const sub_op_regexp = /(H\[.*?\]|P\[.*?\]|M.?\[.*?\]|m.?\[.*?\]|LE\[.*?\]|C\d*\[.*?\]|L\d*\[.*?\])/;
const in_blank_test = /(L\[.*?\]|C\[.*?\])/;
const in_blank_split_re = /(L\[.*?\]|C\[.*?\]|\s.+?\s)/;
const seper_pair = { m: ' ', L: '\n', P: '、', Ms: '；' };

function setDefault(matchs_) {
  let temp = [];
  matchs_.forEach(match_ => {
    const in_re = /(H|P|M.?|m.?|P|C|LE)\[(.*?)\]/g;
    match_ = match_.replace(in_re, (in_match, in_type, in_op) => {
      let temps = [];
      in_op.split('|&').forEach(element => {
        const rp = replace_plus(element);
        if (rp.is_default) temps.push(rp.option);
      });
      if (temps.length > 0 && in_type === 'H') return temps[0];
      if (temps.length > 0 && in_type === 'M') return jointer(temps);
      if (temps.length > 0 && seper_pair.hasOwnProperty(in_type)) return jointer(temps, seper_pair[in_type]);
      if (in_type === 'LE') return in_op;
      return '';
    });
    temp.push(match_);
  });
  return temp.join('');
}

// Entry point: returns a <form id="main"> DOM element
function buildForm(mainText) {
  const form = document.createElement('form');
  form.id = 'main';
  const matches = mainText.split(re);
  matches.forEach((match, index) => {
    const check = regexp.exec(match);
    const wrapper = document.createElement('div');
    wrapper.style.margin = '2px 0';
    if (check) {
      wrapper.appendChild(buildAnyOptions(check[1], check[2], index.toString(), null, false));
    } else if (in_blank_test.test(match)) {
      wrapper.appendChild(buildBlinkSent(match, index.toString()));
    } else {
      const lbl = document.createElement('label');
      lbl.id = index.toString();
      lbl.textContent = match;
      wrapper.appendChild(lbl);
    }
    form.appendChild(wrapper);
  });
  return form;
}

function buildAnyOptions(type, optionsStr, index, handleChangeValue, in_op) {
  // Escape | inside nested bracket expressions so we can split on outer | only
  const re_nested = /H\[.+?\]|P\[.+?\]|M.?\[.+?\]|m.?\[.+?\]|C\[.+?\]/g;
  if (re_nested.test(optionsStr)) {
    optionsStr = optionsStr.replace(re_nested, m => m.replace(/\|/g, '|&'));
  }

  let options;
  if (in_op) {
    options = optionsStr.split('|&');
  } else {
    options = optionsStr.split(/\|(?!\&)/);
  }

  let g_num = 3;
  let effectiveType = type;
  if (type.length > 1 && type[0] === 'G') {
    g_num = parseInt(type[1], 10);
    if (g_num > 12) g_num = 12;
    effectiveType = 'G';
  }

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.alignItems = 'center';
  container.style.gap = '4px';

  switch (effectiveType) {
    case 'H':
    case 'h':
      buildHOptions(container, options, index, handleChangeValue);
      break;
    case 'V':
    case 'v':
      container.style.flexDirection = 'column';
      container.style.alignItems = 'flex-start';
      buildVOptions(container, options, index, handleChangeValue, effectiveType);
      break;
    case 'L':
    case 'm':
    case 'P':
    case 'M':
    case 'Ms':
      container.style.flexDirection = 'column';
      container.style.alignItems = 'flex-start';
      buildMOptions(container, options, index, handleChangeValue, effectiveType);
      break;
    case 'G':
      container.style.flexDirection = 'column';
      container.style.alignItems = 'flex-start';
      buildGOptions(container, options, index, g_num);
      break;
    case 'MR':
      buildMROptions(container, options, index, handleChangeValue);
      break;
    case 'c':
      buildCOptions(container, options, index);
      break;
    default:
      container.textContent = '[unknown type: ' + type + ']';
  }
  return container;
}

function buildHOptions(container, options, index, handleChangeValue) {
  options.forEach((option, i) => {
    if (sub_op_regexp.test(option)) option = option.replace(sub_op_regexp, '');
    const rp = replace_plus(option);
    const id = index + '_' + i;
    const inp = document.createElement('input');
    inp.type = 'radio';
    inp.name = index;
    inp.id = id;
    inp.value = rp.option;
    if (rp.is_default) inp.defaultChecked = true;
    if (handleChangeValue) inp.addEventListener('change', handleChangeValue);
    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.textContent = rp.option;
    const span = document.createElement('span');
    span.style.marginRight = '4px';
    span.appendChild(inp);
    span.appendChild(lbl);
    container.appendChild(span);
  });
}

function buildVOptions(container, options, index, handleChangeValue, parentType) {
  options.forEach((option, i) => {
    const rp = replace_plus(option);
    const id = index + '_' + i;
    if (sub_op_regexp.test(option)) {
      const sub_matchs = rp.option.split(sub_op_regexp);
      container.appendChild(buildInOptions(sub_matchs, id, index, parentType || 'V', rp.is_default));
    } else {
      const inp = document.createElement('input');
      inp.type = 'radio';
      inp.name = index;
      inp.id = id;
      inp.value = rp.option;
      if (rp.is_default) inp.defaultChecked = true;
      const lbl = document.createElement('label');
      lbl.htmlFor = id;
      lbl.textContent = rp.option;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '4px';
      row.appendChild(inp);
      row.appendChild(lbl);
      container.appendChild(row);
    }
  });
}

function buildMOptions(container, options, index, handleChangeValue, parentType) {
  options.forEach((option, i) => {
    const rp = replace_plus(option);
    const id = index + '_' + i;
    if (sub_op_regexp.test(option)) {
      const sub_matchs = rp.option.split(sub_op_regexp);
      container.appendChild(buildInOptions(sub_matchs, id, index, parentType || 'M', rp.is_default));
    } else {
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.name = index;
      inp.id = id;
      inp.value = rp.option;
      if (rp.is_default) inp.defaultChecked = true;
      const lbl = document.createElement('label');
      lbl.htmlFor = id;
      lbl.textContent = rp.option;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '4px';
      row.appendChild(inp);
      row.appendChild(lbl);
      container.appendChild(row);
    }
  });
}

function buildGOptions(container, options, index, g_num) {
  const copy = [...options];
  const chunks = [];
  while (copy.length) chunks.push(copy.splice(0, g_num));
  chunks.forEach((group, g_i) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'row';
    row.style.gap = '4px';
    group.forEach((option, o_i) => {
      const id = index + '_' + g_i + '_' + o_i;
      if (option === 'blank') {
        const sp = document.createElement('span');
        sp.style.minWidth = '40px';
        row.appendChild(sp);
      } else {
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.name = index;
        inp.id = 'G_' + id;
        inp.value = option;
        const lbl = document.createElement('label');
        lbl.htmlFor = 'G_' + id;
        lbl.textContent = option;
        const cell = document.createElement('span');
        cell.style.minWidth = '40px';
        cell.appendChild(inp);
        cell.appendChild(lbl);
        row.appendChild(cell);
      }
    });
    container.appendChild(row);
  });
}

function buildMROptions(container, options, index, handleChangeValue) {
  options.forEach((option, i) => {
    const rp = replace_plus(option);
    const id = index + '_' + i;
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.name = index;
    inp.id = id;
    inp.value = rp.option;
    if (rp.is_default) inp.defaultChecked = true;
    if (handleChangeValue) inp.addEventListener('change', handleChangeValue);
    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.textContent = rp.option;
    const span = document.createElement('span');
    span.style.marginRight = '4px';
    span.appendChild(inp);
    span.appendChild(lbl);
    container.appendChild(span);
  });
}

function buildCOptions(container, options, index) {
  const sel = document.createElement('select');
  sel.name = index;
  options.forEach((option) => {
    const opt = document.createElement('option');
    if (option.match(/[+]/g)) {
      option = option.replace(/[+]/g, '');
      opt.selected = true;
    }
    opt.value = option;
    opt.textContent = option;
    sel.appendChild(opt);
  });
  container.appendChild(sel);
}

function buildInOptions(sub_matchs, label, index, parentType, is_default) {
  let currentValue = setDefault(sub_matchs);
  let isChecked = is_default;

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexDirection = 'row';
  row.style.alignItems = 'center';
  row.style.flexWrap = 'wrap';
  row.style.gap = '4px';
  row.style.backgroundColor = 'lightgreen';
  row.style.margin = '2px 0';
  row.style.padding = '2px 4px';
  row.style.borderRadius = '3px';

  const isRadio = (parentType === 'V' || parentType === 'v');
  const mainInp = document.createElement('input');
  mainInp.type = isRadio ? 'radio' : 'checkbox';
  mainInp.name = index;
  mainInp.id = label;
  mainInp.value = currentValue;
  mainInp.checked = isChecked;
  mainInp.addEventListener('change', () => {
    isChecked = !isChecked;
    mainInp.checked = isChecked;
  });
  row.appendChild(mainInp);

  const handleSubChange = () => {
    let temp = '';
    sub_matchs.forEach((item, sub_index) => {
      const name = label + '_' + item + '_' + sub_index;
      if (sub_op_regexp.test(item)) {
        const in_type = item.split('[')[0];
        const els = document.getElementsByName(name);
        const temps = [];
        els.forEach(el => {
          if (el.checked) {
            temps.push(el.value);
          } else if (in_type === 'LE' && el.value) {
            temps.push(el.value);
          }
        });
        if (seper_pair.hasOwnProperty(in_type)) {
          temp += jointer(temps, seper_pair[in_type]);
        } else {
          temp += jointer(temps);
        }
      } else {
        temp += item;
      }
    });
    currentValue = temp;
    mainInp.value = temp;
    isChecked = true;
    mainInp.checked = true;
  };

  sub_matchs.forEach((sub_match, sub_index) => {
    const id = label + '_' + sub_match + '_' + sub_index;
    const in_re = /(H|P|M.?|m.?|P|C|LE)\[(.*?)\]/g;
    const sub_check = in_re.exec(sub_match);
    if (sub_check) {
      const type = sub_check[1];
      const cell = document.createElement('span');
      switch (type) {
        case 'H':
          cell.appendChild(buildAnyOptions('H', sub_check[2], id, handleSubChange, true));
          break;
        case 'LE': {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.size = 4;
          inp.name = id;
          inp.addEventListener('input', handleSubChange);
          cell.appendChild(inp);
          break;
        }
        case 'L':
        case 'P':
        case 'm':
        case 'M':
        case 'Ms':
          cell.appendChild(buildAnyOptions('MR', sub_check[2], id, handleSubChange, true));
          break;
        default:
          cell.textContent = sub_match;
      }
      row.appendChild(cell);
    } else {
      const lbl = document.createElement('label');
      lbl.htmlFor = label;
      lbl.textContent = sub_match;
      row.appendChild(lbl);
    }
  });

  return row;
}

function buildBlinkSent(blinksents, index) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.alignItems = 'center';
  const blinks = blinksents.split(in_blank_split_re);
  blinks.forEach((a_blink, b_index) => {
    const in_blank_re = /(L|C)\[(.*?)\]/g;
    const b_check = in_blank_re.exec(a_blink);
    const id = index + '_b' + b_index;
    if (b_check) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.name = id;
      container.appendChild(inp);
    } else {
      const lbl = document.createElement('label');
      lbl.textContent = a_blink;
      container.appendChild(lbl);
    }
  });
  return container;
}
