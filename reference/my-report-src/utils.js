/*global chrome*/

function jointer(list, seper) {
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (seper) return list.join(seper);
  if (list.length === 2) return list[0] + ' and ' + list[1];
  return list.slice(0, list.length - 1).join(', ') + ' and ' + list[list.length - 1];
}

function replace_plus(option) {
  let is_default = false;
  if (option.charAt(0) === '+') {
    option = option.substr(1);
    is_default = true;
  }
  option = option.replace('\\+', '+');
  return { option, is_default };
}

function download(data, fileName) {
  if (fileName) {
    const a = document.createElement('a');
    const file = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const filename = prompt('Define your file name.');
    if (!filename) return;
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
  }
}

function openFileDialog(accept, callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', callback);
  input.dispatchEvent(new MouseEvent('click'));
}

function buildTree(myJson, onItemClick) {
  const root = document.createElement('ul');
  root.className = 'tree-root';

  myJson.category_list.forEach(cate => {
    if (!cate) return;
    const li = document.createElement('li');
    li.className = 'tree-category';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tree-category-label';
    labelSpan.textContent = '\u25B6 ' + cate;

    const subList = document.createElement('ul');
    subList.className = 'tree-items';
    subList.style.display = 'none';

    labelSpan.addEventListener('click', () => {
      const isOpen = subList.style.display !== 'none';
      subList.style.display = isOpen ? 'none' : 'block';
      labelSpan.textContent = (isOpen ? '\u25B6 ' : '\u25BC ') + cate;
    });

    if (myJson.category[cate]) {
      myJson.category[cate].forEach(item => {
        if (!item) return;
        const itemLi = document.createElement('li');
        itemLi.className = 'tree-item';
        itemLi.textContent = item.shortcut;
        itemLi.addEventListener('click', () => onItemClick(item.main, cate, item.shortcut));
        subList.appendChild(itemLi);
      });
    }

    li.appendChild(labelSpan);
    li.appendChild(subList);
    root.appendChild(li);
  });

  return root;
}
