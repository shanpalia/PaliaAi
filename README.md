# Palia AI

**Palia AI — Your Smart AI Assistant**

A chat-first AI assistant website by **ShanPalia**.

## Product

- Chat-first homepage inspired by modern AI assistant UX
- Palia AI circular brand icon
- Conversation history
- Streaming-ready AI responses
- Markdown/code rendering
- File/image attachment UI
- Search/reasoning controls
- Image Generator and AI Tools views
- Free plan: **100 messages/day**
- Pro subscription architecture
- Supabase authentication/storage/database support
- OpenRouter/Gemini provider adapters
- Razorpay-ready subscription architecture
- Protected admin view

## Run locally

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env`. Never commit real API keys or payment secrets.

## Build

```bash
npm run lint
npm run build
npm start
```

## Security

AI provider keys must remain server-side. The browser must never receive OpenRouter, Gemini, Supabase service-role, or Razorpay secret credentials.

## Branding

**Palia AI**  
Developer by **ShanPalia**
