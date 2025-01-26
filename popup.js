let elements = null;

// 等待DOM加载完成
window.addEventListener('load', async () => {  // 改用 load 事件替代 DOMContentLoaded
  console.log('Window load started');
  try {
    await initializeApp();
  } catch (e) {
    console.error('Initialization failed:', e);
    showError('初始化失败: ' + e.message);
  }
});

// 添加存储权限检查函数
async function checkStoragePermission() {
  return new Promise(resolve => {
    chrome.permissions.contains({
      permissions: ['storage']
    }, (result) => {
      console.log('Storage permission:', result);
      resolve(result);
    });
  });
}

async function initializeApp() {
  // 确保DOM完全加载
  if (!document.getElementById('history-list')) {
    throw new Error('Required elements not found in DOM');
  }

  // 初始化元素
  const success = initializeElements();
  if (!success) {
    throw new Error('Failed to initialize elements');
  }

  // 按顺序初始化功能
  try {
    // 检查存储权限
    const hasStoragePermission = await checkStoragePermission();
    if (!hasStoragePermission) {
      console.warn('Storage permission not granted');
    }

    // 1. 绑定基本事件
    elements.formatBtn?.addEventListener('click', () => formatJSON(elements));
    elements.compressBtn?.addEventListener('click', () => compressJSON(elements));
    elements.exportBtn?.addEventListener('click', () => exportJSON(elements));

    // 2. 设置其他处理器
    setupPasteHandler(elements);
    
    // 3. 加载选项
    await new Promise(resolve => {
      loadOptions();
      setTimeout(resolve, 100);
    });

    // 清理可能的损坏数据
    await cleanupStorage();

    // 4. 最后加载历史记录
    await loadHistoryAsync();

    console.log('All initialization completed successfully');
  } catch (e) {
    console.error('Error during initialization steps:', e);
    throw e;
  }
}

function initializeElements() {
  elements = {
    input: document.getElementById('json-input'),
    output: document.getElementById('formatted-json'),
    errorMsg: document.getElementById('error-message'),
    historyList: document.getElementById('history-list'), // 确保ID匹配HTML中的history-list
    formatBtn: document.getElementById('format-btn'),
    compressBtn: document.getElementById('compress-btn'),
    exportBtn: document.getElementById('export-btn')
  };

  // 验证所有元素是否存在
  const missingElements = Object.entries(elements)
    .filter(([key, el]) => !el)
    .map(([key]) => key);

  if (missingElements.length > 0) {
    showError(`Missing elements: ${missingElements.join(', ')}`);
    elements = null;
    return false;
  }

  return true;
}

function handleFormatClick() {
  if (!elements) return;
  
  const input = elements.input.value;
  elements.output.textContent = '';
  elements.errorMsg.textContent = '';

  if (!input.trim()) {
    elements.errorMsg.textContent = 'Please input JSON content';
    return;
  }

  try {
    const parsed = JSON.parse(input);
    const formatted = JSON.stringify(parsed, null, 2);
    elements.output.innerHTML = syntaxHighlight(formatted);
    saveToHistory(formatted);
    saveToClipboard(formatted);
  } catch (e) {
    showError('JSON Parse Error: ' + e.message);
  }
}

// 修改为异步版本的loadHistory
async function loadHistoryAsync() {
  return new Promise((resolve, reject) => {
    if (!chrome.storage || !chrome.storage.local) {
      reject(new Error('Storage API not available'));
      return;
    }

    console.log('Starting to load history...');
    if (elements.historyList) {
      elements.historyList.innerHTML = '<li>Loading history...</li>';
    } else {
      console.error('History list element not found');
      reject(new Error('History list element not found'));
      return;
    }

    chrome.storage.local.get({history: []}, function(result) {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        elements.historyList.innerHTML = '<li>Failed to load history</li>';
        reject(chrome.runtime.lastError);
        return;
      }

      try {
        let history = result.history;
        console.log('Raw history data:', history);

        if (!Array.isArray(history)) {
          console.warn('Invalid history format, resetting');
          history = [];
        }

        if (history.length === 0) {
          elements.historyList.innerHTML = '<li>No history available</li>';
          resolve();
          return;
        }

        const historyHTML = history
          .slice(-5) // 取最后5条记录
          .reverse() // 反转数组使最新记录在前
          .filter(item => { // 先过滤无效条目
            try {
              const content = typeof item === 'string' ? item : item?.content || '';
              JSON.parse(content);
              return true;
            } catch (e) {
              console.warn('过滤无效历史记录:', item);
              return false;
            }
          })
          .map(item => {
            // 兼容旧格式数据
            const record = typeof item === 'string' ? 
              { content: item, timestamp: new Date().toISOString() } : 
              item;
            const content = record.content || '';
            const safeContent = typeof content === 'string' ? content : JSON.stringify(content);
              return `<li data-history-content="${encodeURIComponent(safeContent)}">
              <pre>${escapeHtml(safeContent.substring(0, 50))}...</pre>
              <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
            </li>`;
          })
          .join('');

        if (elements.historyList) {
          elements.historyList.innerHTML = historyHTML;
  // 使用事件委托处理点击
  elements.historyList.addEventListener('click', async (event) => {
    const li = event.target.closest('li[data-history-content]');
    if (!li) return;
    
    // 添加确认提示
            
            try {
              const rawContent = li.dataset.historyContent;
              try {
                // 解码URI编码内容
                const decodedContent = decodeURIComponent(rawContent);
                
                // 添加外层大括号确保完整JSON格式
                const jsonContent = decodedContent.startsWith('{') ? decodedContent : `{${decodedContent}}`;
                elements.input.value = jsonContent;
                try {
                  // 重新解析并格式化完整JSON结构
                  const parsed = JSON.parse(jsonContent);
                  const formatted = JSON.stringify(parsed, null, 2);
                  elements.output.innerHTML = syntaxHighlight(formatted);
                } catch (e) {
                  // 保留原始内容并显示错误
                  showError(`历史记录格式错误: ${e.message}`);
                  elements.output.textContent = '';
                }
                
                // 自动调整输入框高度
                elements.input.style.height = 'auto';
                elements.input.style.height = `${elements.input.scrollHeight}px`;
              } catch (e) {
                // 显示原始未解码内容用于调试
                console.error('原始内容:', rawContent);
                console.error('解码后内容:', decodeURIComponent(rawContent));
                
                showError(`历史记录解析失败: ${e.message}`);
                elements.input.value = decodeURIComponent(rawContent); // 保留解码后的原始内容
                elements.output.textContent = ''; 
                elements.errorMsg.innerHTML = `
                  <div>JSON解析失败</div>
                  <div class="error-content">${escapeHtml(decodeURIComponent(rawContent).substring(0, 100))}...</div>
                `;
              }
              
              // 自动扩展输入框高度
              elements.input.style.height = 'auto';
              elements.input.style.height = elements.input.scrollHeight + 'px';
              
              // 滚动到输入框位置
              elements.input.scrollIntoView({behavior: 'smooth', block: 'center'});
              
              // 添加视觉反馈
              elements.input.classList.add('content-loaded');
              setTimeout(() => elements.input.classList.remove('content-loaded'), 1000);
            } catch (e) {
              console.error('Error parsing history content:', e);
            }
          });
        } else {
          console.error('History list element not found when rendering');
        }
        console.log('History loaded and rendered');
        resolve();
      } catch (e) {
        console.error('Error processing history:', e);
        elements.historyList.innerHTML = '<li>Error processing history</li>';
        reject(e);
      }
    });
  });
}

function showError(message) {
  console.error(message);
  if (elements && elements.errorMsg) {
    elements.errorMsg.textContent = message;
    setTimeout(() => elements.errorMsg.textContent = '', 5000);
  } else {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.textContent = message;
    document.body.insertBefore(errorContainer, document.body.firstChild);
    setTimeout(() => errorContainer.remove(), 5000);
  }
}

function compressJSON(elements) {
  const {input, output, errorMsg} = elements;
  try {
    const parsed = JSON.parse(input.value);
    const compressed = JSON.stringify(parsed);
    output.textContent = compressed;
    saveToClipboard(compressed);
  } catch (e) {
    handleError(e, 'Compressing JSON', errorMsg);
  }
}

function exportJSON(elements) {
  const {output, errorMsg} = elements;
  const json = output.textContent;
  if (!json) return;
  
  try {
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    handleError(e, 'Exporting JSON', errorMsg);
  }
}

function handleError(error, context = '', errorElement) {
  console.error(`Error in ${context}:`, error);
  if (errorElement) {
    errorElement.textContent = `Error: ${context} - ${error.message}`;
  }
}

// 修改保存历史记录的函数
function saveToHistory(formatted) {
  console.log('Attempting to save to history:', formatted);
  
  // 新增有效性验证
  try {
    JSON.parse(formatted);
  } catch (e) {
    console.error('Invalid JSON, not saving to history:', e);
    return;
  }

  if (!chrome.storage || !chrome.storage.local) {
    console.error('Chrome storage API not available');
    return;
  }

  chrome.storage.local.get({history: []}, function(result) {
    if (chrome.runtime.lastError) {
      console.error('Error getting history:', chrome.runtime.lastError);
      return;
    }

    let history = result.history;
    if (!Array.isArray(history)) {
      console.warn('History was not an array, resetting');
      history = [];
    }

    // 保存原始输入内容而非格式化后的内容
    history.push({
      content: elements.input.value.trim(),
      timestamp: new Date().toISOString()
    });

    // 只保留最近的10条记录
    history = history.slice(-10);

    // 保存更新后的历史记录
    chrome.storage.local.set({history: history}, function() {
      if (chrome.runtime.lastError) {
        console.error('Error saving history:', chrome.runtime.lastError);
        return;
      }
      console.log('History saved successfully');
    });
  });
}

function setupPasteHandler(elements) {
  const {input, errorMsg} = elements;
  input.addEventListener('paste', async (e) => {
    const text = await navigator.clipboard.readText();
    try {
      JSON.parse(text);
      input.value = text;
    } catch (e) {
      handleError(e, 'Pasting JSON', errorMsg);
    }
  });
}

function loadOptions() {
  chrome.storage.sync.get({theme: 'light', indent: 2}, (options) => {
    try {
      // 设置主题
      if (document.documentElement) {
        document.documentElement.setAttribute('data-theme', options.theme);
      }
      
      // 如果存在indent-size元素则设置值
      const indentElement = document.getElementById('indent-size');
      if (indentElement) {
        indentElement.value = options.indent;
      }
    } catch (e) {
      console.error('Error loading options:', e);
    }
  });
}

// 修改格式化函数以使用缓存的indent值
function formatJSON(elements) {
  if (!elements) return;
  
  const {input, output, errorMsg} = elements;
  
  output.textContent = '';
  errorMsg.textContent = '';

  if (!input.value.trim()) {
    errorMsg.textContent = 'Please input JSON content';
    return;
  }

  try {
    const parsed = JSON.parse(input.value);
    // 从storage获取indent值
    chrome.storage.sync.get({indent: 2}, (options) => {
      const formatted = JSON.stringify(parsed, null, options.indent);
      output.innerHTML = syntaxHighlight(formatted);
      saveToHistory(formatted);
      saveToClipboard(formatted);
    });
  } catch (e) {
    showError('JSON Parse Error: ' + e.message);
  }
}

async function saveToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Formatted JSON copied to clipboard!');
  } catch (e) {
    handleError(e, 'Saving to Clipboard');
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function syntaxHighlight(json) {
  const container = document.createElement('pre');
  const walk = (obj, isRoot = false) => {
    if (typeof obj === 'object' && obj !== null) {
      if (isRoot) {
        container.appendChild(document.createTextNode(Array.isArray(obj) ? '[\n' : '{\n'));
      }
      
      Object.entries(obj).forEach(([key, value]) => {
        const keySpan = document.createElement('span');
        keySpan.className = 'key';
        keySpan.textContent = `"${key}": `;
        container.appendChild(keySpan);

        if (typeof value === 'object' && value !== null) {
          container.appendChild(document.createTextNode(Array.isArray(value) ? '[\n' : '{\n'));
          walk(value);
          container.appendChild(document.createTextNode(Array.isArray(value) ? ']\n' : '}\n'));
        } else {
          const valueSpan = document.createElement('span');
          valueSpan.className = typeof value;
          valueSpan.textContent = JSON.stringify(value);
          container.appendChild(valueSpan);
        }
        container.appendChild(document.createTextNode('\n'));
      });
    } else {
      const valueSpan = document.createElement('span');
      valueSpan.className = typeof obj;
      valueSpan.textContent = JSON.stringify(obj);
      container.appendChild(valueSpan);
    }
  };
  
  try {
    const parsed = JSON.parse(json);
    walk(parsed, true); // 添加isRoot参数
    // 添加根元素的闭合标签
    container.appendChild(document.createTextNode(Array.isArray(parsed) ? ']' : '}'));
    return container.innerHTML;
  } catch (e) {
    return json;
  }
}

// 添加HTML转义函数
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 添加存储清理函数
async function cleanupStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, function(items) {
      if (chrome.runtime.lastError) {
        console.error('Error checking storage:', chrome.runtime.lastError);
        resolve();
        return;
      }

      if (items.history && !Array.isArray(items.history)) {
        chrome.storage.local.set({history: []}, function() {
          console.log('Reset corrupted history data');
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}
