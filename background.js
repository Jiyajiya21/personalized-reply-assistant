const MENU_ID = 'jiya-draft-selection';

async function configureSidePanel() {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanel();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Draft a reply with Jiya Reply Assistant',
      contexts: ['selection']
    });
  });
});

chrome.runtime.onStartup.addListener(configureSidePanel);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  await chrome.storage.session.set({
    pendingContext: {
      text: info.selectionText || '',
      pageTitle: tab.title || '',
      pageUrl: info.pageUrl || tab.url || '',
      capturedAt: Date.now()
    }
  });

  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'OLLAMA_TAGS') {
    fetch('http://127.0.0.1:11434/api/tags')
      .then((response) => {
        if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
        return response.json();
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'OLLAMA_GENERATE') {
    fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: message.model,
        prompt: message.prompt,
        stream: false,
        options: {
          temperature: 0.35,
          num_predict: 500
        }
      })
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
        return response.json();
      })
      .then((data) => sendResponse({ ok: true, text: data.response || '' }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
