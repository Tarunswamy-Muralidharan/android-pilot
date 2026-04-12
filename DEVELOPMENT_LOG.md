# android-pilot Development Log

## Project Genesis — April 12, 2026

### The Problem

Tested a production Jetpack Compose Android app (JustPass v2.1) using two existing MCP servers for mobile testing. Both had critical flaws:

#### Appium MCP Session (45 min, 90+ tool calls)
- **Screenshot token overflow**: Every screenshot was 94K-283K base64 characters, exceeding MCP limits. Required a 4-step workaround per screenshot: capture -> grep temp filename -> read PNG -> analyze. This alone 4x'd the testing time.
- **No Compose accessibility**: Jetpack Compose elements had almost no `content-desc` attributes. The bottom navigation bar had zero accessibility labels, forcing coordinate-based tapping.
- **Page source overflow**: Full XML hierarchy was 200K+ characters, also exceeding limits.
- **No wait mechanism**: No `waitForElement` or `waitForIdle`. Had to poll with repeated screenshots.
- **Bottom nav coordinate guessing**: First attempt to tap CA Marks tab hit the wrong element because "CA" matched a different content-desc.
- **Results**: 7/13 screens passed, 2 partial, 4 blocked by API token expiry. Zero crashes.

#### Maestro MCP Session (25 min, 50+ tool calls)
- **launch_app: Grade F**: Failed 100% of the time. The most basic operation. Required ADB `am start` as fallback every time.
- **System UI collision**: Tapping `text: "Home"` hit the Android system Home button instead of the app's Home tab, sending the app to background. No way to scope element targeting to app-only.
- **Broken scroll API**: `scroll: direction: UP` threw "Unknown Property: direction". The `scrollUntilVisible` command also failed on LazyColumn content.
- **Compose incompatibility**: No resource-ids for Compose elements, making `tapOn: id:` completely useless.
- **No wait/poll mechanism**: Same as Appium — no way to wait for async content to load.
- **Results**: 8 screens tested, ~60% first-attempt success rate, ~40% required workarounds, ~25% of session time wasted on workarounds.

### The Insight

Both tools abstract over device communication through framework layers (Appium's UiAutomator2 driver, Maestro's CLI binary). These abstractions introduce failure modes. But the underlying ADB commands used as workarounds — `adb shell input tap`, `adb shell am start`, `adb exec-out screencap` — worked 100% of the time in both sessions.

**The solution: build directly on ADB.**

### Design Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Communication layer | ADB direct | 100% reliable in both test sessions. No framework abstraction overhead. |
| Language | TypeScript | FastMCP SDK is TypeScript-native. npm ecosystem for sharp/xml parsing. |
| Screenshot compression | sharp (resize 540px + JPEG q60) | Reduces ~400KB PNG to ~20KB JPEG. Fits within MCP token limits. |
| Element targeting | App-scoped hierarchy filter | Eliminates system UI collision by filtering nodes by package name. |
| Compose support | testTag from resource-id suffix | Compose exposes testTag via accessibility tree's resource-id field. |
| Batch actions | `act` tool | Combines tap+wait+screenshot into 1 call instead of 6+. |

---

## Implementation Progress

### Phase 1 — MVP (Core ADB + Basic Tools)
- [ ] `src/adb/client.ts` — ADB executor with device auto-detect
- [ ] `src/adb/screenshot.ts` — Screencap + resize + JPEG compress pipeline
- [ ] `src/adb/input.ts` — Tap, swipe, text, keyevent
- [ ] `src/adb/packages.ts` — am start, pm install
- [ ] `src/tools/launch.ts` — Launch app
- [ ] `src/tools/screenshot.ts` — Smart screenshot
- [ ] `src/tools/tap.ts` — Coordinate-based tap (Phase 1)
- [ ] `src/tools/type.ts` — Text input
- [ ] `src/tools/back.ts` — Back button
- [ ] `src/tools/info.ts` — Device info
- [ ] `src/tools/shell.ts` — Raw ADB escape hatch
- [ ] `src/server.ts` + `src/index.ts` — FastMCP server wiring
- [ ] Build + test with MCP Inspector

### Phase 2 — Smart Targeting (Hierarchy + Compose)
- [ ] `src/adb/hierarchy.ts` — UI hierarchy XML parser
- [ ] `src/filters/app-scope.ts` — System UI filter by package
- [ ] `src/filters/compose.ts` — Compose testTag extraction
- [ ] `src/tools/find.ts` — Filtered element search
- [ ] `src/tools/hierarchy.ts` — Compact view tree tool
- [ ] Upgrade `tap.ts` — Add text/testTag/index strategies
- [ ] Test: verify "Home" tap scopes to app only

### Phase 3 — Smart Tools (Wait + Batch + Assert)
- [ ] `src/util/poll.ts` — Poll-until-condition helper
- [ ] `src/tools/wait.ts` — Wait for element/text/idle
- [ ] `src/tools/assert.ts` — Verify element state
- [ ] `src/tools/scroll.ts` — Direction + scrollUntilVisible
- [ ] `src/tools/act.ts` — Batch action tool
- [ ] `src/tools/swipe.ts` — Custom swipe
- [ ] `src/tools/home.ts` — System home
- [ ] `src/tools/recents.ts` — App switcher
- [ ] `src/tools/install.ts` — Install APK
- [ ] `src/util/token-budget.ts` — Output size guards
- [ ] End-to-end test: run full JustPass test suite with android-pilot

---

## Benchmarks (Target vs Competitors)

| Metric | Appium MCP | Maestro MCP | android-pilot (target) |
|--------|-----------|-------------|----------------------|
| Screenshot per call | 4 calls | 1 call | **1 call** |
| Screenshot size | 94K-283K chars | ~50K chars | **~27K chars** |
| App launch | Works | Fails 100% | **Works (am start)** |
| System UI collision | N/A (no labels) | Critical (Home) | **Impossible (app-scoped)** |
| Scroll direction | Works | Broken | **Works (ADB swipe)** |
| Wait for element | None | None | **Built-in polling** |
| Hierarchy output | 200K+ chars | 400 lines CSV | **~30 lines filtered** |
| Tool calls per screen | ~7 | ~5 | **~2 (with act)** |
| Full app test (13 screens) | 90+ calls, 45 min | ~65 calls, 25 min | **~30 calls, ~10 min** |
