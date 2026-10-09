# Privacy

Personalized Reply Assistant is designed as a local, draft-only browser extension.

## Data handling

- Conversation content is read only after the user clicks **Scan page & draft**.
- Drafting uses Chrome's on-device AI, a locally running Ollama model, or local templates.
- The extension does not send conversation text to a developer-operated server.
- The extension does not include analytics, advertising, or tracking.
- Conversation text and generated replies are not saved after the side panel closes.
- Personalization settings and drafting-engine preferences are stored locally by Chrome.

## Site access

The extension declares access to Gmail and LinkedIn because they are its primary supported sites. Access to another HTTPS website is requested only when the user asks the extension to scan that page.

## User control

The extension never clicks **Send**. It can copy a draft or place it into a supported editor, but the user must review and send the message manually.

## Repository contents

This repository contains extension source code and documentation only. It does not contain copied emails, LinkedIn conversations, passwords, API keys, authentication tokens, or personal style-training messages.
