# android-pilot

The ultimate Android testing MCP server. ADB-direct, Compose-native, token-aware.

Built to fix every flaw found in [Appium MCP](https://github.com/nickarls/appium-mcp) and [Maestro MCP](https://github.com/nickarls/maestro-mcp) when testing real Jetpack Compose apps on physical devices.

## Why This Exists

After testing a production Android app ([JustPass](https://github.com/Tarunswamy-Muralidharan/-AttendanceWidgetLaudea)) with both Appium MCP and Maestro MCP, we documented every failure:

| Problem | Appium MCP | Maestro MCP | android-pilot |
|---------|-----------|-------------|---------------|
| Screenshot | 4 tool calls, 94K-283K chars overflow | Works but no compression | **1 call, ~27K chars** (540px JPEG) |
| Launch app | Works | **100% failure rate** | `am start` (never fails) |
| Tap "Home" | Misses (no accessibility labels) | **Hits system Home button** | App-scoped (filters by package) |
| Compose support | No testTag, no content-desc | No resource-ids | **testTag + text + index** |
| Scroll direction | Works | **Param throws error** | ADB swipe (always works) |
| Wait for element | None | None | **Built-in polling** with timeout |
| View hierarchy | 200K+ chars overflow | 400 lines CSV, no filtering | **Filtered compact** (~30 lines) |
| Batch actions | 90+ calls for 13 screens | 50+ calls for 8 screens | **`act()` — tap+wait+screenshot in 1 call** |

Full test reports:
- [Appium MCP Test Report (PDF)](docs/appium_test_report.pdf)
- [Maestro MCP Test Report (HTML)](docs/maestro_mcp_review.html)

## Design Principles

1. **ADB-first** — No flaky framework abstractions. Every command goes through `adb shell`, which is 100% reliable.
2. **Token-budget-aware** — All outputs stay within MCP token limits. Screenshots are resized + JPEG compressed. Hierarchies are filtered and compact.
3. **Compose-native** — First-class support for Jetpack Compose `testTag`, semantics tree, and accessibility labels.
4. **App-scoped** — Element targeting NEVER includes system UI. Tapping "Home" always hits the app's Home tab, never the Android system button.
5. **Batch-friendly** — The `act` tool combines tap + wait + screenshot into a single call, reducing 6+ tool calls to 1.
6. **Wait-aware** — Built-in polling for async operations. No more repeated screenshots hoping data has loaded.

## Tools (17 total)

### Core
| Tool | Description |
|------|-------------|
| `launch` | Start app via `am start` — never fails |
| `screenshot` | Compressed inline image (540px JPEG, ~20KB) |
| `tap` | App-scoped: testTag > text > coordinates |
| `find` | Filtered element search, compact output |
| `scroll` | Direction + `scrollUntilVisible` |
| `type` | Text input with Unicode support |
| `back` | Android back button |
| `swipe` | Custom coordinate swipe |

### Smart
| Tool | Description |
|------|-------------|
| `wait` | Poll for element/text/idle with timeout |
| `hierarchy` | Filtered compact view tree |
| `act` | Batch: tap + wait + screenshot in ONE call |
| `info` | Device info, screen size, foreground app |
| `assert` | Verify element state |

### System
| Tool | Description |
|------|-------------|
| `home` | System home (clearly named, no collision) |
| `recents` | App switcher |
| `install` | Install APK |
| `shell` | Raw ADB escape hatch |

## Quick Start

### Prerequisites
- Node.js 22+
- Android SDK with `adb` in PATH (or set `ANDROID_HOME`)
- A connected Android device or emulator

### Install & Build
```bash
git clone https://github.com/Tarunswamy-Muralidharan/android-pilot.git
cd android-pilot
npm install
npm run build
```

### Add to Claude Code
Add to your `.mcp.json`:
```json
{
  "mcpServers": {
    "android-pilot": {
      "command": "node",
      "args": ["path/to/android-pilot/dist/index.js"],
      "env": {
        "ANDROID_HOME": "/path/to/Android/Sdk"
      }
    }
  }
}
```

### Test with MCP Inspector
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Tech Stack

- **TypeScript** with FastMCP v3 + @modelcontextprotocol/sdk
- **ADB** for all device communication (spawn wrapper, no native deps beyond sharp)
- **sharp** for screenshot resize + JPEG compression
- **fast-xml-parser** for UI hierarchy XML parsing
- **zod** for tool parameter validation

## Project Structure
```
src/
  index.ts              # Entry point (stdio transport)
  server.ts             # FastMCP tool registration
  adb/
    client.ts           # ADB command executor
    hierarchy.ts        # UI hierarchy parser + app-scope filter
    screenshot.ts       # Screencap + resize + JPEG compress
    input.ts            # Tap, swipe, text, keyevent
    packages.ts         # App management (am start, pm install)
  tools/                # One file per tool (17 tools)
  filters/
    app-scope.ts        # Filter system UI by package name
    compose.ts          # Extract Compose testTag
  util/
    token-budget.ts     # Output size guards
    poll.ts             # Poll-until-condition helper
```

## License

MIT

## Author

[Tarunswamy Muralidharan](https://github.com/Tarunswamy-Muralidharan)

Built with Claude Code.
