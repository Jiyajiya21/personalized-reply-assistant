const elements = {
  aiStatus: document.querySelector('#aiStatus'),
  siteNotice: document.querySelector('#siteNotice'),
  captureButton: document.querySelector('#captureButton'),
  context: document.querySelector('#context'),
  recipientName: document.querySelector('#recipientName'),
  channel: document.querySelector('#channel'),
  facts: document.querySelector('#facts'),
  instruction: document.querySelector('#instruction'),
  generateButton: document.querySelector('#generateButton'),
  progress: document.querySelector('#progress'),
  draft: document.querySelector('#draft'),
  copyButton: document.querySelector('#copyButton'),
  insertButton: document.querySelector('#insertButton'),
  clearButton: document.querySelector('#clearButton'),
  revisionControls: document.querySelector('#revisionControls'),
  profileFullName: document.querySelector('#profileFullName'),
  profileSignName: document.querySelector('#profileSignName'),
  profileStyle: document.querySelector('#profileStyle'),
  provider: document.querySelector('#provider'),
  connectOllamaButton: document.querySelector('#connectOllamaButton'),
  ollamaModel: document.querySelector('#ollamaModel')
};

let selectedTone = 'default';
let activeSite = 'general';
let chromeAvailability = 'checking';
let ollamaReady = false;

document.querySelectorAll('.tone').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tone').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    selectedTone = button.dataset.tone;
  });
});

elements.captureButton.addEventListener('click', captureFromPage);
elements.generateButton.addEventListener('click', generateDraft);
elements.copyButton.addEventListener('click', copyDraft);
elements.insertButton.addEventListener('click', insertDraft);
elements.clearButton.addEventListener('click', () => {
  elements.draft.value = '';
  elements.instruction.value = '';
  updateDraftActions();
});
elements.draft.addEventListener('input', updateDraftActions);
[elements.profileFullName, elements.profileSignName, elements.profileStyle].forEach((element) => {
  element.addEventListener('change', saveSettings);
});
elements.provider.addEventListener('change', saveSettings);
elements.ollamaModel.addEventListener('change', saveSettings);
elements.connectOllamaButton.addEventListener('click', connectOllama);

chrome.tabs.onActivated.addListener(refreshActiveSite);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) setSiteFromUrl(changeInfo.url);
});

init();

async function init() {
  const saved = await chrome.storage.local.get(['provider', 'ollamaModel', 'profile']);
  elements.provider.value = saved.provider || 'auto';
  elements.profileFullName.value = saved.profile?.fullName || '';
  elements.profileSignName.value = saved.profile?.signName || '';
  elements.profileStyle.value = saved.profile?.style || '';
  if (saved.ollamaModel) addModelOption(saved.ollamaModel, true);

  const sessionState = await chrome.storage.session.get(['pendingContext', 'activePage']);
  const pending = { pendingContext: sessionState.pendingContext };
  if (pending.pendingContext?.text) {
    elements.context.value = pending.pendingContext.text;
    setSiteFromUrl(pending.pendingContext.pageUrl);
    await chrome.storage.session.remove('pendingContext');
  } else if (sessionState.activePage && Date.now() - sessionState.activePage.capturedAt < 10 * 60 * 1000) {
    setSiteFromUrl(sessionState.activePage.pageUrl || '');
  } else {
    const tab = await getActiveTab();
    setSiteFromTab(tab);
  }

  await Promise.all([checkChromeAI(), checkOllama(false)]);
  updateEngineStatus();
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshActiveSite() {
  const tab = await getActiveTab();
  setSiteFromTab(tab);
}

function setSiteFromTab(tab) {
  const title = tab?.title || '';
  if (tab?.url) return setSiteFromUrl(tab.url);
  if (/gmail/i.test(title)) return setSiteFromUrl('https://mail.google.com/');
  if (/linkedin/i.test(title)) return setSiteFromUrl('https://www.linkedin.com/');
  return setSiteFromUrl('');
}

function setSiteFromUrl(url) {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch (_) { /* Ignore non-web tabs. */ }

  if (hostname === 'mail.google.com') {
    activeSite = 'gmail';
    elements.channel.value = 'email';
    showNotice('Gmail ready: Scan reads the open thread and prepares a draft. It never sends.');
  } else if (hostname.endsWith('linkedin.com')) {
    activeSite = 'linkedin';
    elements.channel.value = 'linkedin';
    showNotice('LinkedIn ready: open a conversation, then use Scan page & draft. You will still review and send it yourself.');
  } else {
    activeSite = 'general';
    elements.channel.value = 'chat';
    showNotice('Open the conversation you want to answer, then use Scan page & draft.');
  }
  updateDraftActions();
}

function showNotice(message, error = false) {
  elements.siteNotice.textContent = message;
  elements.siteNotice.classList.remove('hidden');
  elements.siteNotice.classList.toggle('error', error);
}

async function captureFromPage() {
  setBusy(true, 'Reading the current page…');
  let shouldDraft = false;
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error('No active page was found.');
    setSiteFromTab(tab);

    let pageOrigin = '';
    try {
      const pageUrl = new URL(tab.url || '');
      if (pageUrl.protocol === 'https:') pageOrigin = `${pageUrl.origin}/*`;
    } catch (_) { /* The tab URL can be hidden until access is granted. */ }

    const looksLikeGmail = activeSite === 'gmail' ||
      (tab.url || '').startsWith('https://mail.google.com/') ||
      /gmail/i.test(tab.title || '');
    const looksLikeLinkedIn = activeSite === 'linkedin' ||
      /linkedin/i.test(tab.title || '') ||
      (tab.url || '').includes('linkedin.com');
    const requestedOrigin = looksLikeGmail
      ? 'https://mail.google.com/*'
      : looksLikeLinkedIn
        ? 'https://www.linkedin.com/*'
        : pageOrigin;
    if (requestedOrigin) {
      const allowed = await chrome.permissions.contains({ origins: [requestedOrigin] });
      if (!allowed) {
        const granted = await chrome.permissions.request({ origins: [requestedOrigin] });
        if (!granted) throw new Error('Page access was not approved. The assistant cannot scan this conversation without it.');
      }
      if (looksLikeGmail) setSiteFromUrl('https://mail.google.com/');
    }

    const executionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: looksLikeLinkedIn },
      args: [getProfile()],
      func: async (profile) => {
        const selected = window.getSelection()?.toString().trim() || '';
        const host = location.hostname;
        const visible = (node) => {
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const deepQueryAll = (selector, root = document, seen = new Set()) => {
          if (!root || seen.has(root)) return [];
          seen.add(root);
          const matches = [...root.querySelectorAll(selector)];
          for (const node of root.querySelectorAll('*')) {
            if (node.shadowRoot) matches.push(...deepQueryAll(selector, node.shadowRoot, seen));
            if (node.tagName === 'IFRAME') {
              try {
                if (node.contentDocument) matches.push(...deepQueryAll(selector, node.contentDocument, seen));
              } catch (_) { /* Cross-origin frames are scanned separately by Chrome. */ }
            }
          }
          return [...new Set(matches)];
        };
        const clean = (value) => String(value || '').replace(/\n{3,}/g, '\n\n').trim();
        const firstName = (value) => clean(value).replace(/\s*[|•·].*$/, '').split(/\s+/)[0] || '';

        if (selected.length > 10) {
          return { ok: true, site: host.endsWith('linkedin.com') ? 'linkedin' : 'selection', context: selected };
        }

        if (host === 'mail.google.com') {
          const expandAll = document.querySelector('[aria-label="Expand all"], [data-tooltip="Expand all"], [title="Expand all"]');
          if (expandAll && visible(expandAll)) {
            expandAll.click();
            await new Promise((resolve) => setTimeout(resolve, 450));
          }

          const subject = document.querySelector('h2.hP')?.textContent?.trim() || '';
          const accountLabel = document.querySelector('[aria-label^="Google Account:"]')?.getAttribute('aria-label') || '';
          const accountEmail = accountLabel.match(/\(([^)]+@[^)]+)\)/)?.[1]?.toLowerCase() || '';
          const accountName = accountLabel
            .replace(/^Google Account:\s*/i, '')
            .replace(/\s*\([^)]+@[^)]+\).*$/, '')
            .trim();
          const configuredName = clean(profile?.fullName).toLowerCase();
          const bodies = [...document.querySelectorAll('.a3s')].filter((node) => {
            const box = node.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && node.textContent.trim();
          }).slice(-8);

          const structuredMessages = bodies.map((body, index) => {
            const container = body.closest('.adn') || body.parentElement;
            const sender = container?.querySelector('.gD')?.getAttribute('name') ||
              container?.querySelector('.gD')?.textContent?.trim() || '';
            const senderEmail = container?.querySelector('.gD')?.getAttribute('email') || '';
            const date = container?.querySelector('.g3')?.getAttribute('title') ||
              container?.querySelector('.g3')?.textContent?.trim() || '';
            const fromSelf = (senderEmail && accountEmail && senderEmail.toLowerCase() === accountEmail) ||
              (configuredName && clean(sender).toLowerCase() === configuredName);
            return {
              fromSelf,
              sender,
              senderEmail,
              text: [
                `MESSAGE ${index + 1} — ${fromSelf ? 'SENT BY USER' : 'RECEIVED BY USER'}`,
                sender ? `From: ${sender}` : '',
                senderEmail ? `Sender email: ${senderEmail}` : '',
                date ? `Date: ${date}` : '',
                body.innerText.trim()
              ].filter(Boolean).join('\n')
            };
          });

          if (!structuredMessages.length) {
            return { ok: false, error: 'Open an email conversation in Gmail, then click Scan page & draft again.' };
          }
          const latest = structuredMessages.at(-1);
          const status = latest.fromSelf
            ? 'LATEST MESSAGE STATUS: SENT BY USER — waiting for the other person to respond.'
            : 'LATEST MESSAGE STATUS: RECEIVED BY USER — a reply may be needed.';
          return {
            ok: true,
            site: 'gmail',
            accountName,
            latestFromSelf: latest.fromSelf,
            recipientName: latest.fromSelf ? '' : firstName(latest.sender),
            context: [`Subject: ${subject}`, status, ...structuredMessages.map((message) => message.text)]
              .filter(Boolean).join('\n\n---\n\n')
          };
        }

        if (host.endsWith('linkedin.com')) {
          const selectors = [
            '.msg-overlay-conversation-bubble--is-active',
            '.msg-convo-wrapper',
            '.msg-thread',
            '.msg-s-message-list',
            '[role="dialog"]'
          ];
          const editors = deepQueryAll(
            '.msg-form__contenteditable, [contenteditable="true"][role="textbox"], [contenteditable="true"], textarea, [role="textbox"][aria-label*="message" i], [aria-label*="Write a message" i]'
          ).filter(visible);
          const editorAncestors = editors.flatMap((editor) => {
            const ancestors = [];
            let node = editor.parentElement;
            for (let depth = 0; node && depth < 14; depth += 1, node = node.parentElement) {
              const text = clean(node.innerText);
              if (visible(node) && text.length > 40 && text.length < 20000) ancestors.push(node);
            }
            return ancestors;
          });
          const candidates = [...new Set([
            ...selectors.flatMap((selector) => deepQueryAll(selector)),
            ...editorAncestors
          ])]
            .filter(visible)
            .map((node) => ({ node, text: clean(node.innerText) }))
            .filter((item) => item.text.length > 30 && item.node.querySelector(
              '.msg-form__contenteditable, [contenteditable="true"], textarea, [role="textbox"][aria-label*="message" i], [aria-label*="Write a message" i]'
            ))
            .sort((a, b) => {
              const conversationScore = (item) => {
                const messageMarkers = (item.text.match(/sent the following messages?/gi) || []).length;
                const profileLinks = item.node.querySelectorAll('a[href*="/in/"]').length;
                return (messageMarkers * 4) + Math.min(profileLinks, 3);
              };
              return (conversationScore(b) - conversationScore(a)) || (a.text.length - b.text.length);
            });
          const conversation = candidates[0];
          if (!conversation) {
            return { ok: false, error: 'Open one specific LinkedIn conversation so its message box is visible, then use Scan page & draft.' };
          }
          const nameNode = conversation.node.querySelector(
            '.msg-overlay-bubble-header__title, .msg-thread__link-to-profile, .msg-conversation-card__participant-names, h2'
          );
          const senderMarkers = [...conversation.text.matchAll(/([^\n]+?) sent the following messages?/gi)];
          const latestSender = senderMarkers.at(-1)?.[1] || '';
          const configuredName = clean(profile?.fullName).toLowerCase();
          return {
            ok: true,
            site: 'linkedin',
            latestFromSelf: Boolean(configuredName && clean(latestSender).toLowerCase().includes(configuredName)),
            recipientName: firstName(nameNode?.textContent),
            context: conversation.text.slice(-12000)
          };
        }

        const selectors = [
          '[role="log"]',
          '[role="feed"]',
          '[data-testid*="conversation" i]',
          '[class*="conversation" i]',
          '[class*="thread" i]',
          'main'
        ];
        const candidates = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
          .filter(visible)
          .map((node) => clean(node.innerText))
          .filter((text) => text.length > 30)
          .sort((a, b) => a.length - b.length);
        if (!candidates.length) {
          return { ok: false, error: 'I could not find a visible conversation on this page. Select its text and scan again.' };
        }
        return { ok: true, site: 'general', context: candidates[0].slice(-12000) };
      }
    });
    const result = executionResults.find((entry) => entry.result?.ok)?.result || executionResults[0]?.result;

    if (!result?.ok) throw new Error(result?.error || 'The page context could not be captured.');
    elements.context.value = result.context;
    if (!elements.profileFullName.value.trim() && result.accountName) {
      elements.profileFullName.value = result.accountName;
      if (!elements.profileSignName.value.trim()) {
        elements.profileSignName.value = result.accountName.split(/\s+/)[0] || '';
      }
      await saveSettings();
    }
    if (result.recipientName) elements.recipientName.value = result.recipientName;
    if (result.site === 'gmail') setSiteFromUrl('https://mail.google.com/');
    if (result.site === 'linkedin') setSiteFromUrl('https://www.linkedin.com/');
    if (result.latestFromSelf) {
      elements.draft.value = '';
      updateDraftActions();
      showNotice('No reply drafted: your message is the latest one in this thread, so you are waiting for their response.');
    } else {
      elements.draft.value = '';
      elements.instruction.value = '';
      elements.facts.value = '';
      updateDraftActions();
      showNotice('Conversation scanned. Creating your draft now…');
      shouldDraft = true;
    }
  } catch (error) {
    showNotice(error.message.includes('Cannot access')
      ? 'Chrome could not grant access to this page. Reload the page once, then use Scan page & draft again.'
      : error.message, true);
  } finally {
    setBusy(false);
  }
  if (shouldDraft) await generateDraft();
}

async function checkChromeAI() {
  if (typeof LanguageModel === 'undefined') {
    chromeAvailability = 'unavailable';
    return;
  }
  try {
    chromeAvailability = await LanguageModel.availability(languageOptions());
  } catch (_) {
    chromeAvailability = 'unavailable';
  }
}

function languageOptions() {
  return {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
  };
}

async function connectOllama() {
  try {
    const granted = await chrome.permissions.request({
      origins: ['http://127.0.0.1:11434/*', 'http://localhost:11434/*']
    });
    if (!granted) throw new Error('Local Ollama access was not approved.');
    await checkOllama(true);
    updateEngineStatus();
  } catch (error) {
    showNotice(error.message, true);
  }
}

async function checkOllama(showResult) {
  const allowed = await chrome.permissions.contains({ origins: ['http://127.0.0.1:11434/*'] });
  if (!allowed) return false;
  const response = await chrome.runtime.sendMessage({ type: 'OLLAMA_TAGS' });
  ollamaReady = Boolean(response?.ok && response.data?.models?.length);
  if (ollamaReady) {
    const saved = await chrome.storage.local.get('ollamaModel');
    elements.ollamaModel.replaceChildren();
    response.data.models.forEach((model) => addModelOption(model.name, model.name === saved.ollamaModel));
    if (!elements.ollamaModel.value) elements.ollamaModel.selectedIndex = 0;
    await saveSettings();
    if (showResult) showNotice('Ollama is connected. Your installed local model is ready.');
  } else if (showResult) {
    showNotice('Ollama is not running or has no downloaded model yet.', true);
  }
  return ollamaReady;
}

function addModelOption(name, selected) {
  if (!name || [...elements.ollamaModel.options].some((option) => option.value === name)) return;
  const option = document.createElement('option');
  option.value = name;
  option.textContent = name;
  option.selected = Boolean(selected);
  elements.ollamaModel.append(option);
}

async function saveSettings() {
  await chrome.storage.local.set({
    provider: elements.provider.value,
    ollamaModel: elements.ollamaModel.value,
    profile: getProfile()
  });
  updateEngineStatus();
}

function getProfile() {
  const fullName = elements.profileFullName.value.trim();
  return {
    fullName,
    signName: elements.profileSignName.value.trim() || fullName.split(/\s+/)[0] || '',
    style: elements.profileStyle.value.trim()
  };
}

function chooseProvider() {
  const selected = elements.provider.value;
  if (selected !== 'auto') return selected;
  if (chromeAvailability !== 'unavailable') return 'chrome';
  if (ollamaReady) return 'ollama';
  return 'templates';
}

function updateEngineStatus() {
  const provider = chooseProvider();
  const labels = {
    chrome: chromeAvailability === 'available' ? 'Chrome AI ready' : 'Chrome AI setup',
    ollama: ollamaReady ? 'Ollama ready' : 'Ollama not ready',
    templates: 'Limited mode'
  };
  elements.aiStatus.textContent = labels[provider];
  elements.aiStatus.className = `status ${provider === 'templates' || (provider === 'ollama' && !ollamaReady) ? 'limited' : 'ready'}`;
}

async function generateDraft() {
  const context = elements.context.value.trim();
  if (!context) {
    showNotice('Capture or paste the conversation before drafting.', true);
    elements.context.focus();
    return;
  }

  const latestFromUser = /LATEST MESSAGE STATUS:\s*SENT BY USER/i.test(context);
  const explicitFollowUp = /\b(?:follow[- ]?up|send another|new message)\b/i.test(elements.instruction.value);
  if (latestFromUser && !explicitFollowUp) {
    elements.draft.value = '';
    updateDraftActions();
    showNotice('No reply drafted: your message is already the latest one. You are waiting for the other person to respond.');
    return;
  }

  const availabilitySuggestion = ReplyCore.suggestAvailability(context);
  const userFacts = elements.facts.value.trim();
  const instruction = elements.instruction.value.trim();
  const userProvidedTimes = ReplyCore.findTimes(`${userFacts}\n${instruction}`);
  const facts = availabilitySuggestion && !userProvidedTimes.length
    ? [userFacts, availabilitySuggestion.factText].filter(Boolean).join('\n')
    : userFacts;

  const input = {
    context,
    recipientName: elements.recipientName.value.trim(),
    facts,
    instruction,
    tone: selectedTone,
    channel: elements.channel.value,
    currentDraft: elements.draft.value.trim(),
    profile: getProfile()
  };
  const provider = chooseProvider();
  setBusy(true, provider === 'chrome' ? 'Preparing Chrome’s on-device model…' : 'Drafting locally…');

  try {
    let result;
    if (provider === 'chrome') result = await generateWithChrome(input);
    else if (provider === 'ollama') result = await generateWithOllama(input);
    else result = ReplyCore.fallbackDraft(input);

    if (result.needsFacts || result.text.startsWith('NEEDS_FACTS:')) {
      const message = result.text.replace(/^NEEDS_FACTS:\s*/i, '');
      showNotice(message, true);
      return;
    }
    elements.draft.value = cleanModelOutput(result.text, Boolean(availabilitySuggestion));
    updateDraftActions();
    showNotice(availabilitySuggestion
      ? 'Draft created with suggested availability. Adjust the times below if needed.'
      : 'Draft created. You can adjust the wording or tone below if needed.');
  } catch (error) {
    showNotice(`Drafting failed: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function generateWithChrome(input) {
  if (typeof LanguageModel === 'undefined') throw new Error('Chrome on-device AI is not available in this browser profile.');
  const options = {
    ...languageOptions(),
    initialPrompts: [{ role: 'system', content: ReplyCore.buildSystemPrompt(input.profile) }],
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        elements.progress.textContent = `Downloading the local Chrome model: ${Math.round(event.loaded * 100)}%`;
      });
    }
  };
  const session = await LanguageModel.create(options);
  try {
    const text = await session.prompt(ReplyCore.buildPrompt(input));
    return { needsFacts: /^NEEDS_FACTS:/i.test(text.trim()), text: text.trim() };
  } finally {
    session.destroy();
  }
}

async function generateWithOllama(input) {
  if (!ollamaReady || !elements.ollamaModel.value) throw new Error('Connect Ollama and choose an installed model first.');
  const prompt = `${ReplyCore.buildSystemPrompt(input.profile)}\n\n${ReplyCore.buildPrompt(input)}`;
  const response = await chrome.runtime.sendMessage({
    type: 'OLLAMA_GENERATE',
    model: elements.ollamaModel.value,
    prompt
  });
  if (!response?.ok) throw new Error(response?.error || 'Ollama did not return a draft.');
  const text = response.text.trim();
  return { needsFacts: /^NEEDS_FACTS:/i.test(text), text };
}

function cleanModelOutput(text, keepSchedulingOptions = false) {
  let cleaned = String(text || '')
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^Subject:.*\n+/i, '')
    .replace(/\[\[\/?INTERNAL_SCHEDULING_OPTIONS\]\]/gi, '')
    .replace(/These are proposed slots[^.]*calendar was checked\.?/gi, '')
    .replace(/Use these options naturally in the reply\.?/gi, '')
    .replace(/They are editable suggestions[^.]*calendar was checked\.?/gi, '')
    .replace(/SYSTEM-GENERATED EDITABLE AVAILABILITY SUGGESTION\s*:\s*/gi, '')
    .replace(/FACTS AND EDITABLE SCHEDULING SUGGESTIONS\s*:\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!keepSchedulingOptions && /(?:^|\n)\s*[-•]\s*(?:[A-Z]{3,9}\s+\d{1,2}|\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i.test(cleaned)) {
    cleaned = cleaned.replace(/(?:^|\n)(?:\s*[-•]\s*(?:[A-Z]{3,9}\s+\d{1,2}\s+)?\d{1,2}(?::\d{2})?\s*(?:AM|PM)(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))?\s*)+/gi, '\n');
  }
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

async function copyDraft() {
  if (!elements.draft.value.trim()) return;
  await navigator.clipboard.writeText(elements.draft.value.trim());
  showNotice('Draft copied. You can paste it where you want to reply.');
}

async function insertDraft() {
  const text = elements.draft.value.trim();
  if (!text) return;

  try {
    const tab = await getActiveTab();
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [text],
      func: async (draftText) => {
        const visible = (node) => {
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        };
        const deepQueryAll = (selector, root = document, seen = new Set()) => {
          if (!root || seen.has(root)) return [];
          seen.add(root);
          const matches = [...root.querySelectorAll(selector)];
          for (const node of root.querySelectorAll('*')) {
            if (node.shadowRoot) matches.push(...deepQueryAll(selector, node.shadowRoot, seen));
            if (node.tagName === 'IFRAME') {
              try {
                if (node.contentDocument) matches.push(...deepQueryAll(selector, node.contentDocument, seen));
              } catch (_) { /* Ignore inaccessible frames. */ }
            }
          }
          return [...new Set(matches)];
        };
        const findEditor = () => {
          const active = document.activeElement;
          if (active && (active.isContentEditable || ['INPUT', 'TEXTAREA'].includes(active.tagName)) && visible(active)) return active;
          const candidates = deepQueryAll(
            'div[aria-label="Message Body"][contenteditable="true"], .msg-form__contenteditable, textarea, input[type="text"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"][aria-label*="message" i], [aria-label*="Write a message" i]'
          ).filter(visible);
          return candidates.at(-1);
        };

        let target = findEditor();
        if (!target && location.hostname === 'mail.google.com') {
          const replySelectors = [
            '[data-tooltip="Reply"]',
            '[aria-label="Reply"]',
            '.ams.bkH',
            '.amn > .ams'
          ];
          const replyButtons = replySelectors
            .flatMap((selector) => deepQueryAll(selector))
            .filter(visible);
          const replyButton = replyButtons.at(-1);
          if (replyButton) {
            replyButton.click();
            for (let attempt = 0; attempt < 12 && !target; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 150));
              target = findEditor();
            }
          }
        }
        if (!target) return { ok: false, error: 'I could not open the reply box. Open the email conversation and try Insert again.' };

        target.focus();
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? target.value.length;
          target.setRangeText(draftText, start, end, 'end');
        } else if (target.isContentEditable) {
          const selection = window.getSelection();
          if (!selection.rangeCount || !target.contains(selection.anchorNode)) {
            const range = document.createRange();
            range.selectNodeContents(target);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          document.execCommand('insertText', false, draftText);
        } else {
          return { ok: false, error: 'Focus an editable reply box first.' };
        }
        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: draftText }));
        return { ok: true };
      }
    });
    if (!result?.ok) throw new Error(result?.error || 'The draft could not be inserted.');
    showNotice('Draft inserted. Review it on the page before pressing Send.');
  } catch (error) {
    showNotice(error.message, true);
  }
}

function updateDraftActions() {
  const hasDraft = Boolean(elements.draft.value.trim());
  elements.copyButton.disabled = !hasDraft;
  elements.insertButton.disabled = !hasDraft;
  elements.insertButton.title = '';
  elements.revisionControls.classList.toggle('hidden', !hasDraft);
}

function setBusy(busy, message = '') {
  elements.generateButton.disabled = busy;
  elements.captureButton.disabled = busy;
  if (busy) {
    elements.progress.textContent = message;
    elements.progress.classList.remove('hidden');
  } else {
    elements.progress.classList.add('hidden');
  }
}
