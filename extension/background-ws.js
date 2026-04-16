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
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// Tool implementations
async function navigate(url) {
  const tab = await browser.tabs.update({ url });
  return { tabId: tab.id, url: tab.url };
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
  await browser.tabs.executeScript(tab.id, {
    code: `
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Element not found');
      el.click();
      { success: true }
    `
  });
  return { success: true };
}

async function typeText(selector, text, submit = false) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  await browser.tabs.executeScript(tab.id, {
    code: `
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Element not found');
      el.focus();
      el.value = ${JSON.stringify(text)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      ${submit ? 'el.form?.submit();' : ''}
      { success: true }
    `
  });
  return { success: true };
}

async function takeScreenshot(fullPage = false) {
  const dataUrl = await browser.tabs.captureVisibleTab(null, { format: 'png' });
  return { screenshot: dataUrl };
}

async function executeJavaScript(code) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const results = await browser.tabs.executeScript(tab.id, { code });
  return { result: results[0] };
}

async function wait(duration) {
  await new Promise(r => setTimeout(r, duration * 1000));
  return { success: true };
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
