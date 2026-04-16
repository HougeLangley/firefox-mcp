/**
 * OpenClaw Firefox MCP - Content Script
 * Runs in web pages to provide advanced interaction capabilities
 */

(function() {
  'use strict';
  
  console.log('[Firefox MCP] Content script loaded');
  
  // Listen for messages from background script
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getPageInfo') {
      sendResponse({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState
      });
    }
    return true;
  });
})();
