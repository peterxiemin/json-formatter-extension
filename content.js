// 自动检测页面中的JSON内容
function detectJSON() {
  const preElements = document.querySelectorAll('pre');
  preElements.forEach(pre => {
    try {
      const json = JSON.parse(pre.textContent);
      const formatted = JSON.stringify(json, null, 2);
      if (formatted !== pre.textContent) {
        pre.innerHTML = syntaxHighlight(json);
        pre.classList.add('formatted-json');
        addFormatButton(pre);
      }
    } catch (e) {
      // 非JSON内容跳过
    }
  });
}

function syntaxHighlight(json) {
  return JSON.stringify(json, null, 2)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
    match => {
      let cls = 'number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'key' : 'string';
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
}

function addFormatButton(pre) {
  const btn = document.createElement('button');
  btn.textContent = 'Format JSON';
  btn.style.marginLeft = '10px';
  btn.onclick = () => {
    pre.innerHTML = syntaxHighlight(JSON.parse(pre.textContent));
  };
  pre.parentNode.insertBefore(btn, pre.nextSibling);
}

// 初始化检测
document.addEventListener('DOMContentLoaded', detectJSON);
