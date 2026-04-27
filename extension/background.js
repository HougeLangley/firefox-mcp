/**
 * OpenClaw Firefox MCP - Background Script
 * Handles Native Messaging communication with MCP server
 */



// Global state
let nativePort = null;
let isConnected = false;
let messageId = 0;
const pendingRequests = new Map();
const HOST_NAME = "openclaw.firefox.mcp";

// Logger
function log(...args) {
  console.log("[Firefox MCP]", ...args);
}

function error(...args) {
  console.error("[Firefox MCP]", ...args);
}

/**
 * Connect to Native Messaging host
 */
function connectNativeHost() {
  if (nativePort) {
    log("Already connected");
    return true;
  }

  try {
    log("Connecting to Native Messaging host...");
    nativePort = browser.runtime.connectNative(HOST_NAME);
    
    nativePort.onMessage.addListener(handleNativeMessage);
    nativePort.onDisconnect.addListener(handleDisconnect);
    
    isConnected = true;
    log("Connected to Native Messaging host");
    
    // Send initial handshake
    sendToNative({
      type: "handshake",
      version: "1.0.0"
    });
    
    return true;
  } catch (err) {
    error("Failed to connect:", err);
    nativePort = null;
    isConnected = false;
    return false;
  }
}

/**
 * Handle disconnect from Native Messaging host
 */
function handleDisconnect() {
  error("Disconnected from Native Messaging host");
  isConnected = false;
  nativePort = null;
  
  // Reject all pending requests
  for (const [id, { reject }] of pendingRequests) {
    reject(new Error("Native Messaging disconnected"));
  }
  pendingRequests.clear();
}

/**
 * Handle message from Native Messaging host
 */
function handleNativeMessage(message) {
  log("Received from native:", message.type || message.tool, message.id);
  
  // Check if this is a response to a pending request
  if (message.id && pendingRequests.has(message.id)) {
    const { resolve, reject } = pendingRequests.get(message.id);
    pendingRequests.delete(message.id);
    
    if (message.error) {
      reject(new Error(message.error));
    } else {
      resolve(message.result);
    }
    return;
  }
  
  // Handle request from MCP server (tool call)
  if (message.type === "request" && message.tool) {
    handleToolRequest(message);
    return;
  }
  
  // Handle handshake response
  if (message.type === "handshake") {
    log("Handshake acknowledged by MCP server");
    return;
  }
  
  log("Unknown message type:", message);
}

/**
 * Send message to Native Messaging host
 */
function sendToNative(message) {
  if (!nativePort) {
    throw new Error("Not connected to Native Messaging host");
  }
  
  nativePort.postMessage(message);
}

/**
 * Send request to Native Messaging host and wait for response
 */
async function sendRequest(tool, params = {}) {
  if (!nativePort && !connectNativeHost()) {
    throw new Error("Failed to connect to Native Messaging host");
  }
  
  const id = `msg_${++messageId}_${Date.now()}`;
  
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("Request timeout"));
      }
    }, 30000);
    
    sendToNative({
      id,
      type: "request",
      tool,
      params
    });
  });
}

/**
 * Handle tool request from MCP server
 */
async function handleToolRequest(message) {
  const { id, tool, params } = message;
  
  try {
    const result = await executeTool(tool, params);
    sendToNative({
      id,
      type: "response",
      result
    });
  } catch (err) {
    sendToNative({
      id,
      type: "response",
      error: err.message
    });
  }
}

/**
 * Execute tool
 */
async function executeTool(tool, params) {
  log("Executing tool:", tool, params);
  
  switch (tool) {
    case "firefox_navigate":
      return await navigate(params.url);
      
    case "firefox_get_tabs":
      return await getTabs();
      
    case "firefox_switch_tab":
      return await switchTab(params.tabId);
      
    case "firefox_close_tab":
      return await closeTab(params.tabId);
      
    case "firefox_new_tab":
      return await newTab(params.url);
      
    case "firefox_get_current_url":
      return await getCurrentUrl();
      
    case "firefox_get_page_title":
      return await getPageTitle();
      
    case "firefox_get_page_content":
      return await getPageContent();
      
    case "firefox_click":
      return await clickElement(params.selector);
      
    case "firefox_type":
      return await typeText(params.selector, params.text, params.submit);
      
    case "firefox_screenshot":
      return await takeScreenshot(params.fullPage);
      
    case "firefox_execute_js":
      return await executeJavaScript(params.code);
      
    case "firefox_wait":
      return await wait(params.duration);
      
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// ==================== Tool Implementations ====================

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
    active: t.active,
    windowId: t.windowId
  }));
}

async function switchTab(tabId) {
  await browser.tabs.update(tabId, { active: true });
  return { success: true };
}

async function closeTab(tabId) {
  if (tabId) {
    await browser.tabs.remove(tabId);
  } else {
    const tab = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab[0]) {
      await browser.tabs.remove(tab[0].id);
    }
  }
  return { success: true };
}

async function newTab(url) {
  const tab = await browser.tabs.create({ url });
  return { tabId: tab.id, url: tab.url };
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
  if (!tab) throw new Error("No active tab");
  
  try {
    const results = await browser.tabs.executeScript(tab.id, {
      code: `
        (() => {
          try {
            const body = document.body;
            return {
              title: document.title,
              url: window.location.href,
              text: body ? body.innerText.substring(0, 10000) : "",
              html: body ? body.innerHTML.substring(0, 50000) : ""
            };
          } catch (e) {
            return { error: e.message };
          }
        })()
      `
    });
    
    if (results[0]?.error) {
      throw new Error(results[0].error);
    }
    return results[0];
  } catch (err) {
    throw new Error(`Failed to get page content: ${err.message}`);
  }
}

async function clickElement(selector) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab");
  
  try {
    const results = await browser.tabs.executeScript(tab.id, {
      code: `
        (() => {
          try {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) throw new Error("Element not found: ${selector}");
            el.click();
            return { success: true };
          } catch (e) {
            return { error: e.message };
          }
        })()
      `
    });
    
    if (results[0]?.error) {
      throw new Error(results[0].error);
    }
    return results[0] || { success: true };
  } catch (err) {
    throw new Error(`Failed to click element: ${err.message}`);
  }
}

async function typeText(selector, text, submit = false) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab");
  
  try {
    const results = await browser.tabs.executeScript(tab.id, {
      code: `
        (() => {
          try {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) throw new Error("Element not found: ${selector}");
            el.focus();
            el.value = ${JSON.stringify(text)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            ${submit ? `
            if (el.form) {
              el.form.submit();
            } else {
              // Try pressing Enter
              const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 });
              el.dispatchEvent(event);
            }
            ` : ''}
            return { success: true };
          } catch (e) {
            return { error: e.message };
          }
        })()
      `
    });
    
    if (results[0]?.error) {
      throw new Error(results[0].error);
    }
    return results[0] || { success: true };
  } catch (err) {
    throw new Error(`Failed to type text: ${err.message}`);
  }
}

async function takeScreenshot(fullPage = false) {
  const dataUrl = await browser.tabs.captureVisibleTab(null, { format: "png" });
  return { screenshot: dataUrl };
}

async function executeJavaScript(code) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab");
  
  try {
    const results = await browser.tabs.executeScript(tab.id, {
      code: `
        (async () => {
          try {
            const result = (async () => { ${code} })();
            return await Promise.resolve(result);
          } catch (e) {
            return { __error: e.message, __stack: e.stack };
          }
        })()
      `
    });
    
    if (results[0]?.__error) {
      throw new Error(`${results[0].__error}\n${results[0].__stack || ''}`);
    }
    return { result: results[0] };
  } catch (err) {
    throw new Error(`JavaScript execution failed: ${err.message}`);
  }
}

async function wait(duration) {
  await new Promise(resolve => setTimeout(resolve, duration * 1000));
  return { success: true };
}

// ==================== Event Listeners ====================

// Auto-connect on startup
browser.runtime.onStartup.addListener(() => {
  log("Extension started");
  connectNativeHost();
});

browser.runtime.onInstalled.addListener(() => {
  log("Extension installed");
  connectNativeHost();
});

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getStatus") {
    sendResponse({
      connected: isConnected,
      hostName: HOST_NAME
    });
  } else if (message.action === "reconnect") {
    if (nativePort) {
      nativePort.disconnect();
      nativePort = null;
    }
    const success = connectNativeHost();
    sendResponse({ success });
  }
  return true;
});

// Initial connection attempt
connectNativeHost();

log("Background script loaded");
