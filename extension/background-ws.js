/**
 * OpenClaw Firefox MCP - Background Script (WebSocket version)
 */

const WS_URL = 'ws://localhost:34567/firefox';

let ws = null;
let isConnected = false;
let reconnectInterval = null;
const pendingRequests = new Map();

function log(...args) {
  console.log('[Firefox MCP]', ...args);
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN) {
    log('Already connected');
    return;
  }
  
  log('Connecting to MCP server...');
  
  try {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      log('Connected to MCP server');
      isConnected = true;
      updateIcon();
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        log('Failed to parse message:', err);
      }
    };
    
    ws.onclose = () => {
      log('Disconnected from MCP server');
      isConnected = false;
      updateIcon();
      scheduleReconnect();
    };
    
    ws.onerror = (err) => {
      log('WebSocket error:', err);
      isConnected = false;
      updateIcon();
    };
  } catch (err) {
    log('Failed to connect:', err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectInterval) return;
  
  log('Scheduling reconnect...');
  reconnectInterval = setTimeout(() => {
    reconnectInterval = null;
    connect();
  }, 5000);
}

function handleMessage(message) {
  log('Received:', message.type, message.id);
  
  if (message.type === 'handshake') {
    log('Handshake from server:', message.version);
    return;
  }
  
  if (message.type === 'request' && message.tool) {
    handleToolRequest(message);
    return;
  }
  
  // Response to our request
  if (message.id && pendingRequests.has(message.id)) {
    const { resolve, reject } = pendingRequests.get(message.id);
    pendingRequests.delete(message.id);
    
    if (message.error) {
      reject(new Error(message.error));
    } else {
      resolve(message.result);
    }
  }
}

async function handleToolRequest(message) {
  const { id, tool, params } = message;
  
  try {
    const result = await executeTool(tool, params);
    send({ id, type: 'response', result });
  } catch (err) {
    send({ id, type: 'response', error: err.message });
  }
}

function send(message) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function executeTool(tool, params) {
  log('Executing tool:', tool, params);
  
  switch (tool) {
    case 'firefox_navigate':
      return await navigate(params.url);
    case 'firefox_get_tabs':
      return await getTabs();
    case 'firefox_get_current_url':
      return await getCurrentUrl();
    case 'firefox_get_page_title':
      return await getPageTitle();
    case 'firefox_get_page_content':
      return await getPageContent();
    case 'firefox_click':
      return await clickElement(params.selector);
    case 'firefox_type':
      return await typeText(params.selector, params.text, params.submit);
    case 'firefox_screenshot':
      return await takeScreenshot(params.fullPage);
    case 'firefox_execute_js':
      return await executeJavaScript(params.code);
    case 'firefox_wait':
      return await wait(params.duration);
    case 'firefox_scroll':
      return await scrollPage(params.direction || 'down', params.pixels || 800);
    case 'firefox_press_key':
      return await pressKey(params.key, params.selector);
    case 'firefox_select':
      return await selectOption(params.selector, params.value);
    case 'firefox_clear':
      return await clearInput(params.selector);
    case 'firefox_hover':
      return await hoverElement(params.selector);
    case 'firefox_refresh':
      return await refreshPage();
    case 'firefox_go_back':
      return await goBack();
    case 'firefox_go_forward':
      return await goForward();
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// Tool implementations
async function navigate(url) {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = activeTab.id;
  
  // 等待页面加载完成
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('Navigation timeout after 30s'));
    }, 30000);
    
    function onUpdated(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(onUpdated);
        resolve({ tabId: tab.id, url: tab.url, title: tab.title });
      }
    }
    
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.update(tabId, { url }).catch(err => {
      clearTimeout(timeout);
      browser.tabs.onUpdated.removeListener(onUpdated);
      reject(err);
    });
  });
}

async function getTabs() {
  const tabs = await browser.tabs.query({});
  return tabs.map(t => ({
    id: t.id,
    url: t.url,
    title: t.title,
    active: t.active
  }));
}

async function getCurrentUrl() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return { url: tabs[0]?.url };
}

async function getPageTitle() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return { title: tabs[0]?.title };
}

async function getPageContent() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `({
      title: document.title,
      url: window.location.href,
      text: document.body?.innerText?.substring(0, 10000) || '',
      html: document.body?.innerHTML?.substring(0, 50000) || ''
    })`
  });
  return results[0];
}

async function clickElement(selector) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `(function(sel) {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Element not found: ' + sel);
      el.click();
      return { success: true, clicked: sel };
    })(${JSON.stringify(selector)})`
  });
  return results[0];
}

async function typeText(selector, text, submit = false) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `(function(sel, txt, sub) {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Element not found: ' + sel);
      el.focus();
      el.value = txt;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (sub && el.form) el.form.submit();
      return { success: true, selector: sel, text: txt };
    })(${JSON.stringify(selector)}, ${JSON.stringify(text)}, ${JSON.stringify(submit)})`
  });
  return results[0];
}

async function takeScreenshot(fullPage = false) {
  const dataUrl = await browser.tabs.captureVisibleTab(null, { format: 'png' });
  return { screenshot: dataUrl };
}

async function executeJavaScript(code) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `(function() { return (${code}); })()`
  });
  return { result: results[0] };
}

async function wait(duration) {
  await new Promise(r => setTimeout(r, duration * 1000));
  return { success: true };
}

async function scrollPage(direction = 'down', pixels = 800) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const scrollY = direction === 'up' ? -pixels : pixels;
  await browser.tabs.executeScript(tab.id, {
    code: `(function() {
      window.scrollBy(0, ${scrollY});
      return { scrolled: true, direction: '${direction}', pixels: ${pixels}, currentY: window.scrollY };
    })()`
  });
  return { success: true, direction, pixels };
}

async function pressKey(key, selector = null) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `(function(key, sel) {
      ${selector ? `const el = document.querySelector(sel);
      if (el) el.focus();` : ''}
      const target = sel ? document.querySelector(sel) : document;
      const event = new KeyboardEvent('keydown', { key: key, bubbles: true });
      target.dispatchEvent(event);
      const eventUp = new KeyboardEvent('keyup', { key: key, bubbles: true });
      target.dispatchEvent(eventUp);
      return { success: true, key: key, selector: sel };
    })(${JSON.stringify(key)}, ${JSON.stringify(selector)})`
  });
  return results[0];
}

async function selectOption(selector, value) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `(function(sel, val) {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Element not found: ' + sel);
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, selector: sel, value: val };
    })(${JSON.stringify(selector)}, ${JSON.stringify(value)})`
  });
  return results[0];
}

async function clearInput(selector) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `(function(sel) {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Element not found: ' + sel);
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true, selector: sel, cleared: true };
    })(${JSON.stringify(selector)})`
  });
  return results[0];
}

async function hoverElement(selector) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, {
    code: `(function(sel) {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Element not found: ' + sel);
      const event = new MouseEvent('mouseover', { bubbles: true });
      el.dispatchEvent(event);
      return { success: true, selector: sel, hovered: true };
    })(${JSON.stringify(selector)})`
  });
  return results[0];
}

async function refreshPage() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  await browser.tabs.reload(tab.id);
  return { success: true, refreshed: true };
}

async function goBack() {
  await browser.tabs.executeScript((await browser.tabs.query({ active: true, currentWindow: true }))[0].id, {
    code: `(function() { history.back(); return { success: true, action: 'back' }; })()`
  });
  return { success: true, action: 'back' };
}

async function goForward() {
  await browser.tabs.executeScript((await browser.tabs.query({ active: true, currentWindow: true }))[0].id, {
    code: `(function() { history.forward(); return { success: true, action: 'forward' }; })()`
  });
  return { success: true, action: 'forward' };
}

function updateIcon() {
  browser.browserAction.setIcon({
    path: isConnected ? 'icons/icon-32.png' : 'icons/icon-16.png'
  });
}

// Message handling from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStatus') {
    sendResponse({ connected: isConnected });
  } else if (message.action === 'reconnect') {
    connect();
    sendResponse({ success: true });
  }
  return true;
});

// Auto-connect on startup
connect();

log('Background script loaded');
