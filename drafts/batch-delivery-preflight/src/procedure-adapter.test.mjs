#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ADAPTER = join(HERE, "../procedure/adapter.mjs");

function callProcedure(root, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [ADAPTER], {
      env: { ...process.env, OPENADAM_IMPLEMENTATION_ROOT: root },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        code,
        stderr: Buffer.concat(err).toString("utf8"),
        response: JSON.parse(Buffer.concat(out).toString("utf8")),
      });
    });
    child.stdin.end(`${JSON.stringify({
      id: "path-boundary",
      procedureId: "org.openadam.batch-delivery.preflight",
      procedureVersion: "0.1.0",
      input,
    })}\n`);
  });
}

test("Procedure and MCP carriers both classify an escaped kit as PATH_FORBIDDEN", async () => {
  if (process.platform === "win32") return;
  const root = await mkdtemp(join(tmpdir(), "batch-procedure-path-"));
  const campaign = join(root, "campaign");
  const outside = join(root, "outside");
  await mkdir(campaign);
  await mkdir(outside);
  await symlink(outside, join(campaign, "icons"), "dir");
  const { code, stderr, response } = await callProcedure(root, {
    root: "campaign",
    spec: {
      family: "batch-delivery",
      kits: [{
        id: "icons",
        kind: "asset-delivery",
        required: true,
        root: "icons",
        spec: {
          slots: [{
            id: "icon-16",
            path: "icon-16.png",
            name: "icon-16.png",
            format: "png",
            width: 16,
            height: 16,
            alpha: "any",
            required: true,
          }],
        },
      }],
    },
  });
  assert.equal(code, 0);
  assert.equal(stderr, "");
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "PATH_FORBIDDEN");
});
