import { spawnSync } from "node:child_process";
let result = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-b"],
  { stdio: "inherit" },
);
if (result.status) process.exit(result.status);
result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  { stdio: "inherit", env: { ...process.env, VITE_BACKEND: "true" } },
);
process.exit(result.status || 0);
