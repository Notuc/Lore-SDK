// Bundles the sidecar into standalone binaries using pkg.
// Run: pnpm --filter @lore/sidecar build:binary
//
// Output:
//   bin/lore-sidecar-win.exe   — Windows x64
//   bin/lore-sidecar-mac       — macOS x64
//   bin/lore-sidecar-linux     — Linux x64

import { execSync } from "child_process";
import { mkdirSync }  from "fs";

mkdirSync("bin", { recursive: true });

console.log("[Lore] Building sidecar binaries...");

execSync(
  "pkg dist/server.js " +
  "--targets node20-win-x64,node20-macos-x64,node20-linux-x64 " +
  "--output bin/lore-sidecar " +
  "--compress GZip",
  { stdio: "inherit" }
);

console.log("[Lore] Binaries written to bin/");
