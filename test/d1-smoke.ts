import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import assert from "node:assert/strict";

const state = await mkdtemp(join(tmpdir(), "taqyeem-d1-smoke-"));
const port = Number(process.env.D1_SMOKE_PORT ?? 8792);
const migrated = spawnSync(
  "./node_modules/.bin/wrangler",
  [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "test/wrangler.d1-smoke.jsonc",
    "--persist-to",
    state,
  ],
  { encoding: "utf8" },
);
assert.equal(migrated.status, 0, migrated.stdout + migrated.stderr);
const child = spawn(
  "./node_modules/.bin/wrangler",
  [
    "dev",
    "--config",
    "test/wrangler.d1-smoke.jsonc",
    "--local",
    "--port",
    String(port),
    "--persist-to",
    state,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(output);
    }
    if (output.includes("Ready on")) {
      ready = true;
      break;
    }
    await setTimeout(200);
  }
  assert.ok(ready, output);
  for (let request = 0; request < 2; request++) {
    let response = await fetch(`http://127.0.0.1:${port}/smoke`, {
      method: "POST",
    });
    let body = await response.text();
    assert.equal(response.status, 200, body);
    assert.equal(JSON.parse(body).ok, true);
    console.log(`Local D1 smoke request ${request + 1}: ${body}`);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    let response = await fetch(`http://127.0.0.1:${port}/guided-smoke`, {
      method: "POST",
    });
    let body = await response.text();
    assert.equal(response.status, 200, body);
    assert.equal(JSON.parse(body).guided, true);
    console.log(`Local D1 guided smoke ${attempt + 1}: ${body}`);
  }
} finally {
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      return resolve();
    }
    child.once("exit", () => resolve());
  });
  await rm(state, { recursive: true, force: true });
}
