# openclaw-pwa — messenger-style fork of PinchChat

A WhatsApp-like client for one person talking to their OpenClaw gateway, built on
top of upstream PinchChat (`MarlBurroW/pinchchat`). Branch `openclaw-pwa`.
Upstream PinchChat stays fully available behind the menu's **Advanced** entry.

## What it adds

- **Messenger UI** (`src/mobile/`): one conversation, bubbles (mine right,
  OpenClaw left), timestamps, date separators, typing indicator, sent ticks,
  system light/dark via the existing theme system. Tool calls, thinking blocks,
  heartbeats and system events are hidden — they remain in the full UI.
- **Android Share Target** (`public/manifest.json` `share_target`,
  `public/sw.js` share block, `src/share/`): text, URLs, images, PDFs, audio
  shared from other apps open in the composer, **never auto-sent**, so a note
  can be added first.
- **Native choice cards** (`src/mobile/useQuestions.ts`, `QuestionCard.tsx`):
  OpenClaw's `ask_user` questions (gateway ≥ 2026.7 protocol:
  `question.requested` / `question.resolve`) as tappable options. Single-choice
  questions answer in one tap. Secret questions are not collected.
- **Outbox** (`src/mobile/MobileApp.tsx`): messages written while offline queue
  locally, survive an app restart (text; attachments are memory-only) and send
  once, in order, on reconnect.
- **Offline start**: with saved credentials, a network failure keeps you in the
  conversation (offline) instead of dropping to the login screen.
- **Real attachment limits**: any file type; images only downscaled above the
  gateway's advertised 6 MiB image limit; 18 MiB per attachment.

## Upstream files touched (merge-conflict surface)

Keep this list current — it is what makes `git merge upstream/main` tractable.

| File | Change | Why |
|---|---|---|
| `src/main.tsx` | 3 lines: import + `getUiMode() === 'mobile' ? <MobileApp/> : <App/>` | entry switch |
| `public/manifest.json` | name, colours, `start_url: /?ui=mobile`, `share_target` | install as "OpenClaw", receive shares |
| `public/sw.js` | appended "Share target" block; existing code untouched | store shared content, works offline |
| `src/hooks/useNotifications.ts` | `APP_NAME` from `VITE_APP_NAME` | tab title |
| `src/hooks/useGateway.ts` | deleted-active-session fallback uses `VITE_AGENT_SESSION` | never silently fall back to `agent:main:main` |
| `src/contexts/ThemeContext*.ts(x)`, `SettingsModal.tsx`, `ThemeSwitcher.tsx`, `i18n.ts` | Sand theme + Teal accent | WhatsApp-like palette (fork commit predating this branch) |

Everything else lives in `src/mobile/` and `src/share/` and never conflicts.
`useGateway.ts` is otherwise **consumed, not edited** — mobile code uses its
returned `getClient` / `addEventListener`. Keep it that way.

## Build settings

| Variable | Prototype value | Meaning |
|---|---|---|
| `VITE_DEFAULT_UI` | `mobile` | default UI when no choice is stored |
| `VITE_APP_NAME` | `OpenClaw` | title |
| `VITE_AGENT_SESSION` | `agent:gateway-lucian:main` | default session (upstream setting) |
| `VITE_AGENT_PREFIX` | `agent:gateway-lucian:` | only show this agent's sessions (upstream setting) |

**Never** set a gateway token at build time: anything in `VITE_*` is compiled
into the public JavaScript. The token is entered once on the login screen and
stays in that device's local storage.

`?ui=full` / `?ui=mobile` switches UI and remembers the choice. The installed
app always launches, and receives shares, in the messenger.

## Known limits

- Notifications only fire while the app is alive in the background; there is no
  push, so a fully closed PWA is silent (upstream behaviour).
- A shared PDF is attached and sent, but the sender's bubble only previews
  images (upstream's optimistic message carries image blocks only).
- iOS Safari does not implement Web Share Target.
- Windows builds: the upstream lockfile is generated on Linux, so install the
  platform binaries with `npm i --no-save @rollup/rollup-win32-x64-msvc
  @tailwindcss/oxide-win32-x64-msvc lightningcss-win32-x64-msvc` (matching
  versions) rather than regenerating the lockfile.
