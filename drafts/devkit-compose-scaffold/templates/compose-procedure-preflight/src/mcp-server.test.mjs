#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { TOOL_NAME, handleMessage } from "./mcp-server.mjs";

test("MCP catalog advertises a closed read-only tool", async () => {
  const listed = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(listed.result.tools.length, 1);
  const tool = listed.result.tools[0];
  assert.equal(tool.name, TOOL_NAME);
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
