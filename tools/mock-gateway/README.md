# Mock OpenClaw gateway

Speaks enough of the gateway protocol to exercise the messenger UI without a real
gateway or a real token: connect handshake, `chat.history`, streamed `chat.send`
replies, `sessions.*`, and the `ask_user` question protocol (`question.requested`,
`question.list`, `question.resolve`).

```bash
cd tools/mock-gateway && npm install && npm start      # ws://127.0.0.1:18789
VITE_DEFAULT_UI=mobile npm run build && npm run preview -- --host 127.0.0.1   # app at :4173
```

Log in with gateway URL `ws://127.0.0.1:18789` and the test token
`local-test-token-not-a-secret` (a fixed test value, not a credential).

Messages: `tech …` / `buy …` → shortcut-style reply; `long` → Markdown stress test;
`ask` → pushes a choice card. Control endpoints on the same port:
`/__drop` (drop sockets), `/__down?ms=N` (refuse connections), `/__ask`, `/__log`
(everything the client sent, attachments summarised).
