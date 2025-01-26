document.addEventListener('DOMContentLoaded', () => {
  const themeSelect = document.getElementById('theme');
  const indentInput = document.getElementById('indent-size');
  const saveBtn = document.getElementById('save-btn');

  if (!themeSelect || !indentInput || !saveBtn) {
    console.error('Required elements not found');
    return;
  }

  // 加载已保存的设置
  chrome.storage.sync.get({theme: 'light', indent: 2}, (options) => {
    if (themeSelect) themeSelect.value = options.theme;
    if (indentInput) indentInput.value = options.indent;
  });

  // 保存设置
  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      theme: themeSelect.value,
      indent: parseInt(indentInput.value) || 2
    }, () => {
      showMessage('Settings saved successfully!');
    });
  });
});

function showMessage(text) {
  const message = document.createElement('div');
  message.textContent = text;
  message.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px;
    background: #4CAF50;
    color: white;
    border-radius: 4px;
  `;
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 2000);
}
