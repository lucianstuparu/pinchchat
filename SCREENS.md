# Screens: status of oc and Shopping

Every screen of both apps, where it stands and its latest screenshot (my.design
principles/10-verify.md). Update a row whenever a screen changes; a screen is **approved** only
after Lucian has used it on his phone.

Status: **approved** (used on the phone, no open remarks) · **built** (checked in the browser at the
test sizes and reviewed, not yet confirmed on the phone) · **rough** (works, known gaps listed) ·
**to redo**.

Screenshots in `docs/screens/` are from the browser at phone width with test data. Some predate the
2026-10-24 unification (sizes, radii and icons changed since): they are marked "before kit".

## oc (oc.stuparu.eu)

| Screen | Status | Latest screenshot | Notes |
|---|---|---|---|
| Chat | built | [oc-chat-375](docs/screens/oc-chat-375.jpg), [320×480](docs/screens/oc-chat-320x480.jpg) | Pinned To do bar, quick starts, input bar (Mic / Send / Stop). Swipe right opens To do. |
| To do (phone, full screen) | built | [light](docs/screens/oc-todo-375-light.jpg), [dark](docs/screens/oc-todo-375-dark.jpg) (before kit) | Numbers, bold names, due chips, topics, glow boxes, areas; repeat shown; put off folded away. |
| To do (laptop column) | built | none yet | Same panel beside the chat. |
| In progress | rough | none yet | Second tab of To do; rows still the older style (no numbers). |
| Item details | built | none yet | Edit title, due, topics, repeat; Remind in 3 days; Not needed; Undo at its foot. |
| Undo bar | built | [oc-todo-undo-375](docs/screens/oc-todo-undo-375.jpg) (before kit) | In the layout of the surface on top. |
| Search | rough | none yet | Finds to-dos, in-progress and messages; rows plainer than To do. |
| Settings | built | none yet | Appearance, accent (terracotta default, teal option), the mic, notifications. |
| Login | rough | none | Upstream PinchChat screen, not restyled. |

## Shopping (shop.stuparu.eu)

| Screen | Status | Latest screenshot | Notes |
|---|---|---|---|
| List | built | [shop-list-undo-375](docs/screens/shop-list-undo-375.jpg) | Shop chips, "Usually about now", To return, Bought lately, Undo above the bar. |
| Input bar | built | [typing](docs/screens/shop-bar-typing-375.jpg), [photo waiting](docs/screens/shop-photo-waiting-375.jpg) (before kit) | Camera 48, box with Clear and "say more", big Mic / Send / Stop; upload row while photos go up. |
| Item sheet | built | none yet | Title, quantity, tags, return date, just me; Remove with Undo. |
| At home (tab) | built | none yet | Inventory by expiry; Used / Thrown away with Undo; its own input bar. |
| Products (tab) | built | none yet | Favourites / All, "×8 at home". |
| Product | rough | none yet | Photos, health note, prices; dense, not reviewed against the kit in detail. |
| Arrival notification | rough | none | Opens the list for the shop; after the 2026-10-22 fix (falls back to oc) not yet confirmed arriving in a shop. |
| Settings | built | none yet | Shared with oc; accent fixed to Keep yellow. |

## To capture next

At the next session with the browser pane visible: every "none yet" row at 375 px light and dark,
and the laptop column at 1440 px.
