# Personalized Reply Assistant - Chrome Extension

A private, draft-only Chrome extension that reads an open Gmail, LinkedIn, or web conversation and suggests a reply in the user's chosen style. The user can revise the tone, copy the result, or insert it into the page. The extension never presses **Send**.

No paid API key is required. Drafting can use Chrome's built-in on-device AI, an optional Ollama model running locally, or the included smart templates.

## Download and install

### Ready-to-load package

`dist` means **distribution**. It contains the packaged extension that people can download and install, while the other files in the repository are the editable source code.

1. Download [`dist/personalized-reply-assistant-v0.4.0.zip`](dist/personalized-reply-assistant-v0.4.0.zip).
2. Extract the ZIP file. Chrome cannot load the ZIP directly.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted folder that directly contains `manifest.json`.
7. Pin **Personalized Reply Assistant** to the Chrome toolbar.

### From the source code

Download or clone this repository, then use **Load unpacked** and select the repository folder. The main Chrome load file is [`manifest.json`](manifest.json).

## Personalize it

1. Open the extension's side panel.
2. Expand **Personalization**.
3. Add your full name and the name you want in your email sign-off.
4. Describe your writing style, for example: `Concise, warm and professional. Use short paragraphs and British English.`
5. Open a conversation and click **Scan page & draft**.

These settings are stored only in the user's Chrome profile. When the full-name field is empty, a Gmail scan can infer the signed-in account name and save it locally. The draft can still be edited before it is inserted or sent.

## What is the Brain?

In **Automatic** mode, the extension uses the first available option in this order:

1. Chrome's on-device Prompt API (Gemini Nano).
2. A local Ollama model, if Ollama is installed, running, and connected.
3. Built-in smart templates for simple replies.

The extension does not connect to ChatGPT or the OpenAI API, and it contains no OpenAI API key. Chrome's Prompt API model is downloaded and run by Chrome on the user's device.

## Main features

- Side panel available beside the current webpage.
- One-click conversation scanning and first-draft generation.
- Personalized full name, sign-off, and writing-style settings.
- Gmail sender-direction checks to avoid answering the user's own latest message.
- LinkedIn conversation scanning and draft insertion.
- Concrete, editable time suggestions for direct availability questions.
- Natural, polite, warmer, shorter, and firmer tone controls.
- Copy and insert actions without automatic sending.
- Selected-text capture as a fallback on supported websites.

## How it works

1. The user opens an email or message and clicks **Scan page & draft**.
2. The extension reads the visible conversation and identifies the latest sender where supported.
3. If the user's message is already the latest one, no reply is drafted.
4. Otherwise, the selected local drafting engine creates a reply using the saved style.
5. The user can change the tone, wording, facts, or suggested availability.
6. **Insert into page** places the draft in the supported editor. The user reviews it and presses **Send**.

## Privacy and safety

- There is no analytics or developer-operated server.
- Chrome AI and Ollama process content locally on the computer.
- Gmail and LinkedIn access is declared because they are the primary supported sites.
- Other websites request access only when **Scan page & draft** is used.
- Conversation text is not saved after the side panel closes.
- The extension stores only personalization and engine preferences locally.
- Automatic sending is intentionally excluded.
- See [PRIVACY.md](PRIVACY.md) for the complete data-handling summary.

## Project structure

| File | Purpose |
| --- | --- |
| `manifest.json` | Main Chrome Manifest V3 load file and permissions |
| `background.js` | Side-panel, context-menu, and local Ollama handling |
| `sidepanel.html` | Extension side-panel interface |
| `styles.css` | Side-panel styling |
| `sidepanel.js` | Page scanning, draft generation, revision, and insertion |
| `core.js` | Personalized prompts, scheduling logic, and template fallback |
| `PRIVACY.md` | Data-handling and user-control documentation |
| `dist/personalized-reply-assistant-v0.4.0.zip` | Ready-to-download extension package |

## Important limitations

- Gmail and LinkedIn can change their page structure, which may require selector updates.
- Suggested availability is an editable proposal; it is not connected to the user's calendar.
- On-device models can make mistakes, so every draft should be checked before sending.
- The extension intentionally does not send messages automatically.
