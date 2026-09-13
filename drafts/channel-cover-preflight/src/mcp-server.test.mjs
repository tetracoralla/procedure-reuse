#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { adapterTest } from "../../../scripts/lib/file-vitals-adapter.mjs";
import { TOOL_NAME, callTool, handleMessage } from "./mcp-server.mjs";

const whenAdapter = adapterTest(test);

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAFT = join(HERE, "..");
const SERVER = join(HERE, "mcp-server.mjs");

function withGrant(fn) {
  const previous = process.env.OPENADAM_CAPABILITY_WORKSPACE_ROOT;
  process.env.OPENADAM_CAPABILITY_WORKSPACE_ROOT = DRAFT;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous === undefined) {
        delete process.env.OPENADAM_CAPABILITY_WORKSPACE_ROOT;
      } else {
        process.env.OPENADAM_CAPABILITY_WORKSPACE_ROOT = previous;
      }
    });
}

test("MCP catalog advertises a closed read-only channel-cover tool", async () => {
  const listed = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(listed.result.tools.length, 1);
  const tool = listed.result.tools[0];
  assert.equal(tool.name, TOOL_NAME);
  assert.equal(tool.name, "channel_cover_preflight");
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.openWorldHint, false);
});

test("empty arguments are a protocol error, not a fake success", async () => {
  const response = await handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: TOOL_NAME, arguments: {} },
  });
  assert.equal(response.error.code, -32602);
});

whenAdapter("good delivery through MCP calls runPreflight and passes", async () => {
  await withGrant(async () => {
    const result = await callTool({
      name: TOOL_NAME,
      arguments: { root: "fixtures/good", specPath: "specs/good.json" },
    });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.status, "pass");
    assert.deepEqual(result.structuredContent.summary.failedIds, []);
    assert.equal(result.structuredContent.observer.capability, "org.openadam.file.inspect@0.1.0");
  });
});

whenAdapter("missing required slot is a successful fail report", async () => {
  await withGrant(async () => {
    const result = await callTool({
      name: TOOL_NAME,
      arguments: { root: "fixtures/bad/missing-slot", specPath: "specs/good.json" },
    });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.status, "fail");
    assert.deepEqual(result.structuredContent.summary.failedIds, ["missing"]);
  });
});

test("MCP source does not contain a scaffold stub", async () => {
  const source = await readFile(SERVER, "utf8");
  assert.equal(source.includes("CORE_NOT_IMPLEMENTED"), false);
});

function rpcSession(requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      cwd: DRAFT,
      env: {
        ...process.env,
        OPENADAM_CAPABILITY_WORKSPACE_ROOT: DRAFT,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(out).toString("utf8");
      const stderr = Buffer.concat(err).toString("utf8");
      const messages = stdout
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      resolve({ code, stdout, stderr, messages });
    });
    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
    child.stdin.end();
  });
}

whenAdapter("stdio initialize then tools/list then a real preflight call", async () => {
  const { messages, stderr, code } = await rpcSession([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: TOOL_NAME,
        arguments: { root: "fixtures/good", specPath: "specs/good.json" },
      },
    },
  ]);
  assert.equal(stderr, "");
  assert.equal(code, 0);
  assert.equal(messages[0].result.serverInfo.name, "channel-cover-preflight");
  assert.deepEqual(messages[1].result.tools.map((tool) => tool.name), [TOOL_NAME]);
  assert.equal(messages[2].result.isError, false);
  assert.equal(messages[2].result.structuredContent.status, "pass");
});
