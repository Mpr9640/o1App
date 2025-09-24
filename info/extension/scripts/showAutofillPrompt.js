// showautofillprompt.js — Full replacement with minor fix
function showFloatingButton() {
  if (document.getElementById('smart-autofill-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'smart-autofill-btn';
  btn.innerText = '⚡Autofill';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    padding: 12px 16px;
    background: #0055FF;
    color: white;
    border: none;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    cursor: pointer;
  `;
  btn.onclick = () => {
    chrome.runtime.sendMessage({ action: 'triggerAutofill' });
    btn.remove(); // hide after click
  };

  document.body.appendChild(btn);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "showAutofillPrompt") { // fixed leading space
    showFloatingButton();
  }
});
