# Jiya Reply Assistant — Chrome extension

This is a private, draft-only Chrome extension. It can scan an open Gmail, LinkedIn or web conversation, draft a reply in Jiya's writing style, revise the tone, copy the result, and insert it into supported reply boxes. It never clicks Send.

The project requires no paid API key. Drafting can use Chrome's on-device AI, an optional Ollama model running locally, or built-in templates.

## What works in version 0.3.6

- Chrome side panel available beside the current webpage.
- One-click **Scan page & draft** for an open Gmail thread.
- Availability requests automatically receive two or three concrete, editable time suggestions based on the requested day and time of day.
- Availability suggestions run only when the latest message directly asks for a date or time; internal drafting labels are never shown in the reply.
- The optional instruction box and tone controls appear only after the first draft is created.
- One-click visible-conversation scanning on LinkedIn and supported websites.
- Gmail Insert opens a closed reply box before placing the draft.
- Gmail messages are labelled as sent or received, and no draft is created when Jiya's own message is the latest in the thread.
- Selected-text capture remains available as a fallback.
- Personalised style rules based on 53 cleaned sent emails.
- Natural, polite, warmer, shorter and firmer controls.
- Chrome on-device Prompt API when the device/browser supports it.
- Optional local Ollama connection, with no cloud API key.
- Limited smart-template fallback for simple replies.
- Copy everywhere and insert into Gmail, LinkedIn and supported editable fields.
- LinkedIn conversation scanning with direct draft insertion into the open message box.

## Privacy and safety

- There is no analytics or external server.
- Chrome AI and Ollama process content locally on the computer.
- Gmail and LinkedIn access is declared explicitly because those are the extension's core supported sites. Other websites request access only when **Scan page & draft** is used.
- The extension stores only engine preferences locally. Conversation text is not saved after the panel closes.
- No automatic sending is implemented.
- Automatic sending is intentionally excluded. Insertion only places the reviewed draft into the open editor.
- See [PRIVACY.md](PRIVACY.md) for the complete data-handling summary.

## How it works

1. The user opens an email or message and clicks **Scan page & draft**.
2. The extension reads the visible conversation and identifies the latest sender.
3. If Jiya already sent the latest message, no reply is drafted.
4. Otherwise, the local drafting engine creates a concise reply in Jiya's writing style.
5. The user can change the tone, wording, facts or suggested availability.
6. **Insert into page** places the draft into Gmail, LinkedIn or another supported editor. The user remains responsible for pressing **Send**.

## Project structure

| File | Purpose |
| --- | --- |
| `manifest.json` | Chrome Manifest V3 configuration and permissions |
| `background.js` | Side-panel, context-menu and local Ollama message handling |
| `sidepanel.html` | Extension side-panel interface |
| `styles.css` | Side-panel styling |
| `sidepanel.js` | Page scanning, draft generation, revision and insertion |
| `core.js` | Voice rules, prompts, scheduling logic and template fallback |
| `PRIVACY.md` | Data-handling and user-control documentation |
| `CHANGELOG.md` | Version history |

## Important limitations

- LinkedIn and Gmail can change their page structure, which may require selector updates.
- Suggested availability is an editable proposal; it is not connected to Jiya's calendar.
- Local models can make mistakes, so every draft should be checked before sending.
- The extension intentionally does not send messages automatically.

## Install for testing

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `personal-reply-assistant-extension` folder.
5. Pin **Jiya Reply Assistant** to the toolbar.
6. Open an email in Gmail and click the extension icon.

Chrome may download its local AI model after the first Draft click. If Chrome AI is unavailable, the status shows **Limited mode**. The extension can then use its safe templates, or connect to Ollama after Ollama and a model are installed separately.

## Test Gmail

1. Open an email thread.
2. Click the extension icon and then **Scan page & draft**.
3. The first draft appears automatically. For availability requests, adjust the suggested date or times if needed.
4. Use **Adjust this draft** only when you want to change the wording, facts or tone.
5. Click **Insert into page**. Gmail's reply box opens automatically when needed.
6. Confirm that nothing is sent until you press Gmail's Send button yourself.

## Test another website

1. Open the conversation you want to answer.
2. Open the extension and click **Scan page & draft**.
3. The first draft appears automatically.
4. Use **Adjust this draft** only when you want to change the wording, facts or tone.
5. Copy the result, or use **Insert into page** on supported sites.

On LinkedIn, **Insert into page** places the text in the open message box. It does not press **Send**.

## Version history

See [CHANGELOG.md](CHANGELOG.md).
