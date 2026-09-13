import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initProject } from "../src/init.mjs";
import { ComposeScaffoldError } from "../src/errors.mjs";
import { loadProject } from "../../../repos/agent-tool-development-kit/src/contracts.mjs";

function options(parent, overrides = {}) {
  return {
    template: "compose-procedure-preflight",
    destination: join(parent, "example-compose"),
    id: "org.example.compose-preflight",
    packageName: "@example/compose-preflight",
    plugin: "example-compose-preflight",
    operation: "example_compose_preflight",
    procedureId: "org.example.compose.preflight",
    name: "Example Compose Preflight",
    summary: "Read-only slot-set preflight using file.inspect observations and combinator comparison.",
    author: "Example Developer",
    license: "UNLICENSED",
    dryRun: false,
    ...overrides,
  };
}

test("dry-run validates the complete plan without writing a destination", async () => {
  const parent = await mkdtemp(join(tmpdir(), "compose-init-plan-"));
  const input = options(parent, { dryRun: true });
  const result = await initProject(input);
  assert.equal(result.status, "ready");
  assert.equal(result.mutation, "not-performed");
  assert.equal(result.template, "compose-procedure-preflight");
  assert.equal(result.files.includes("plugins/example-compose-preflight/.codex-plugin/plugin.json"), true);
  assert.equal(result.files.includes("src/compare.mjs"), true);
  assert.equal(result.files.includes("lib/observe-file-inspect.mjs"), true);
  await assert.rejects(access(input.destination));
});

test("creates a bounded compose project whose declaration binds Procedure + MCP carriers", async () => {
  const parent = await mkdtemp(join(tmpdir(), "compose-init-create-"));
  const input = options(parent);
  const result = await initProject(input);
  assert.equal(result.status, "created");
  const loaded = await loadProject(input.destination);
  assert.equal(loaded.project.id, "org.example.compose-preflight");
  assert.equal(loaded.project.contracts.procedureImplementationManifest, "procedure/implementation-manifest.json");
  assert.equal(loaded.project.checks.some((check) => check.lane === "procedure-conformance"), true);
  const compare = await readFile(join(input.destination, "src/compare.mjs"), "utf8");
  assert.match(compare, /CORE_NOT_IMPLEMENTED/);
  const top = await readdir(input.destination);
  assert.equal(top.includes(".openadam-scaffold"), true);
  assert.equal(JSON.stringify(result).includes(parent), false);
});

test("fails closed when the destination exists", async () => {
  const parent = await mkdtemp(join(tmpdir(), "compose-init-existing-"));
  const input = options(parent, { destination: parent });
  await assert.rejects(
    initProject(input),
    (error) => error instanceof ComposeScaffoldError && error.code === "DESTINATION_EXISTS",
  );
});

test("rejects a symlink destination before mutation", async () => {
  const parent = await mkdtemp(join(tmpdir(), "compose-init-link-"));
  const target = await mkdtemp(join(tmpdir(), "compose-init-target-"));
  const destination = join(parent, "example-compose");
  await symlink(target, destination);
  await assert.rejects(
    initProject(options(parent, { destination })),
    (error) => error instanceof ComposeScaffoldError && error.code === "DESTINATION_EXISTS",
  );
});

test("rejects an unknown template", async () => {
  const parent = await mkdtemp(join(tmpdir(), "compose-init-unknown-"));
  await assert.rejects(
    initProject(options(parent, { template: "node-mcp-provider" })),
    (error) => error instanceof ComposeScaffoldError && error.code === "TEMPLATE_UNSUPPORTED",
  );
});
