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

### Phase 1 — MVP (Core ADB + Basic Tools) ✅
- [x] `src/adb/client.ts` — ADB executor with device auto-detect
- [x] `src/adb/screenshot.ts` — Screencap + resize + JPEG compress pipeline
- [x] `src/adb/input.ts` — Tap, swipe, text, keyevent
- [x] `src/adb/packages.ts` — am start, pm install
- [x] `src/tools/launch.ts` — Launch app
- [x] `src/tools/screenshot.ts` — Smart screenshot
- [x] `src/tools/tap.ts` — Coordinate-based tap (Phase 1)
- [x] `src/tools/type.ts` — Text input
- [x] `src/tools/back.ts` — Back button
- [x] `src/tools/info.ts` — Device info
- [x] `src/tools/shell.ts` — Raw ADB escape hatch
- [x] `src/server.ts` + `src/index.ts` — FastMCP server wiring
- [x] Build + test with MCP Inspector

### Phase 2 — Smart Targeting (Hierarchy + Compose) ✅
- [x] `src/adb/hierarchy.ts` — UI hierarchy XML parser
- [x] `src/filters/app-scope.ts` — System UI filter by package
- [x] `src/filters/compose.ts` — Compose testTag extraction
- [x] `src/tools/find.ts` — Filtered element search
- [x] `src/tools/hierarchy.ts` — Compact view tree tool
- [x] Upgrade `tap.ts` — Add text/testTag/index strategies
- [ ] Test: verify "Home" tap scopes to app only *(pending — needs MCP restart)*

### Phase 3 — Smart Tools (Wait + Batch + Assert) ✅
- [x] `src/util/poll.ts` — Poll-until-condition helper
- [x] `src/tools/wait.ts` — Wait for element/text/idle
- [x] `src/tools/assert.ts` — Verify element state
- [x] `src/tools/scroll.ts` — Direction + scrollUntilVisible
- [x] `src/tools/act.ts` — Batch action tool
- [x] `src/tools/swipe.ts` — Custom swipe
- [x] `src/tools/home.ts` — System home
- [x] `src/tools/recents.ts` — App switcher
- [x] `src/tools/install.ts` — Install APK
- [x] `src/util/token-budget.ts` — Output size guards
- [ ] End-to-end test: run full JustPass test suite with android-pilot *(pending)*

---

## Live Testing Session — April 12, 2026 (Session 2)

### Approach
After restarting Claude Code to load the MCP server, began testing tools against a real Moto G54 (Android 13) with JustPass already installed.

### Test Results

#### ✅ info tool — PASS
- Correctly returned device model ("moto g54 5G"), serial, Android 13, screen 1080x2400.
- First real-device validation that ADB executor and device auto-detect work.

#### ✅ screenshot tool — PASS
- Returned inline JPEG image in a single tool call — no temp files, no multi-step workaround.
- Confirmed the sharp pipeline (screencap → resize 540px → JPEG q60) works end-to-end.
- This alone solves Appium's worst problem (4 tool calls per screenshot, 94K-283K chars each).

#### ✅ launch tool — PASS
- Successfully launched JustPass (`com.example.attendancewidgetlaudea`) using monkey fallback.
- `am start` with category LAUNCHER failed (no exported launcher activity), but monkey fallback injected the event and the app opened.
- This solves Maestro's #1 failure (launch_app: 100% failure rate).

#### ❌ hierarchy / find tools — BLOCKED by foreground detection bug
- Both returned "0 elements" because they were scoping to the wrong package.
- Root cause: `getForegroundPackage()` was reporting YouTube as the foreground app while JustPass was actually on screen.

### Bug #1: Wrong Foreground Package Detection

#### Problem
`getForegroundPackage()` in `src/adb/client.ts` used `dumpsys activity top` and grabbed the **first** `TASK` regex match. On the Moto G54, this command returned a stale list of background task records:

```
TASK 10499:app.revanced.android.youtube id=17079   ← first match (WRONG)
TASK 10224:com.android.vending id=17076
TASK 10521:com.google.android.apps.giant id=17081
TASK 10251:com.google.android.apps.photos id=17082
```

JustPass (`com.example.attendancewidgetlaudea`) **didn't appear at all** in this output despite being the visible, active foreground app. The `dumpsys activity top` command is unreliable for determining the actual foreground activity on Android 13.

#### Investigation
Tested alternative ADB commands to find a reliable foreground detection method:

```bash
# Unreliable — doesn't list all running activities
adb shell dumpsys activity top | grep -E "TASK|ACTIVITY"

# Reliable — always shows the actual resumed activity
adb shell dumpsys activity activities | grep -E "topResumedActivity"
# → topResumedActivity=ActivityRecord{8fdd60b u0 com.example.attendancewidgetlaudea/.MainActivity t17085}
```

The `topResumedActivity` field from `dumpsys activity activities` correctly identified JustPass every time.

#### Fix Applied
Changed both `getForegroundPackage()` and `getDeviceInfo()` in `src/adb/client.ts`:

**Before:**
```typescript
// Used unreliable "dumpsys activity top" + first TASK match
const dump = await adbShell("dumpsys", "activity", "top");
const match = dump.match(/TASK\s+(\S+)/);
return match?.[1]?.split("/")?.[0] ?? "unknown";
```

**After:**
```typescript
// Uses reliable "dumpsys activity activities" + topResumedActivity
const dump = await adbShell("dumpsys", "activity", "activities");
const match = dump.match(/topResumedActivity=ActivityRecord\{[^\s]+\s+\S+\s+([^\s/}]+)/);
return match?.[1] ?? "unknown";
```

#### Impact
This fix is **critical** — hierarchy, find, tap (text/testTag/index), assert, wait, and act all depend on app-scoping via `getForegroundPackage()`. Without this fix, every smart targeting tool returns empty results.

#### Status
- Code fixed and compiled cleanly (zero TypeScript errors)
- **Not yet verified** — MCP server needs restart to load new compiled JS
- After restart, all blocked tools (hierarchy, find, tap-by-text, act) should work

### Challenges & Obstacles Summary

| Challenge | How it was discovered | How it was overcome |
|-----------|----------------------|-------------------|
| Package name mismatch | `launch com.justpass.app` failed with "No activities found" | Used `pm list packages` via shell tool to find real package name: `com.example.attendancewidgetlaudea` |
| Shell pipe parsing | `pm list packages \| grep just` failed — pipe was passed to ADB | Ran `pm list packages` without grep, searched output manually |
| Wrong foreground app | hierarchy/find returned 0 elements while JustPass was on screen | Investigated with `dumpsys activity top` (unreliable), then `dumpsys activity activities` (reliable `topResumedActivity`) |
| MCP server caching | Fix compiled but info still returned old results | Identified that Node.js MCP server caches compiled JS in memory — requires process restart |

### Next Steps (After MCP Restart)
1. Verify foreground detection fix with `info`
2. Test hierarchy + find on JustPass home screen
3. Test tap-by-text navigation (tap "CA Marks" tab)
4. Test act (batch): multi-step flow in one call
5. Test wait + assert for async content
6. Run full JustPass test suite and benchmark

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
