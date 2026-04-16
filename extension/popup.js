/**
 * OpenClaw Firefox MCP - Popup Script
 */

async function updateStatus() {
  try {
    const response = await browser.runtime.sendMessage({ action: "getStatus" });
    const statusEl = document.getElementById('status');
    
    if (response.connected) {
      statusEl.textContent = '✅ Connected to MCP Server';
      statusEl.className = 'status connected';
    } else {
      statusEl.textContent = '❌ Disconnected';
      statusEl.className = 'status disconnected';
    }
  } catch (err) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = '❌ Error: ' + err.message;
    statusEl.className = 'status disconnected';
  }
}

document.getElementById('reconnectBtn').addEventListener('click', async () => {
  const btn = document.getElementById('reconnectBtn');
  btn.textContent = 'Connecting...';
  btn.disabled = true;
  
  try {
    const response = await browser.runtime.sendMessage({ action: "reconnect" });
    await updateStatus();
    btn.textContent = response.success ? 'Connected!' : 'Failed';
  } catch (err) {
    btn.textContent = 'Error';
  }
  
  setTimeout(() => {
    btn.textContent = 'Reconnect';
    btn.disabled = false;
  }, 2000);
});

// Update status on load
updateStatus();
