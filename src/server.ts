import { FastMCP } from "fastmcp";

// Tools
import { launchTool } from "./tools/launch.js";
import { screenshotTool } from "./tools/screenshot.js";
import { tapTool } from "./tools/tap.js";
import { typeTool } from "./tools/type.js";
import { backTool } from "./tools/back.js";
import { infoTool } from "./tools/info.js";
import { shellTool } from "./tools/shell.js";
import { findTool } from "./tools/find.js";
import { hierarchyTool } from "./tools/hierarchy.js";
import { waitTool } from "./tools/wait.js";
import { assertTool } from "./tools/assert.js";
import { scrollTool } from "./tools/scroll.js";
import { actTool } from "./tools/act.js";
import { swipeTool } from "./tools/swipe.js";
import { homeTool } from "./tools/home.js";
import { recentsTool } from "./tools/recents.js";
import { installTool } from "./tools/install.js";
import { bridgeTool } from "./tools/bridge.js";

export function createServer(): FastMCP {
  const server = new FastMCP({
    name: "android-pilot",
    version: "1.0.0",
  });

  // Core tools (Phase 1)
  server.addTool(launchTool);
  server.addTool(screenshotTool);
  server.addTool(tapTool);
  server.addTool(typeTool);
  server.addTool(backTool);
  server.addTool(infoTool);
  server.addTool(shellTool);

  // Smart targeting tools (Phase 2)
  server.addTool(findTool);
  server.addTool(hierarchyTool);

  // Smart action tools (Phase 3)
  server.addTool(waitTool);
  server.addTool(assertTool);
  server.addTool(scrollTool);
  server.addTool(actTool);
  server.addTool(swipeTool);
  server.addTool(homeTool);
  server.addTool(recentsTool);
  server.addTool(installTool);

  // Compose Bridge (Phase 4 — fast path)
  server.addTool(bridgeTool);

  return server;
}
