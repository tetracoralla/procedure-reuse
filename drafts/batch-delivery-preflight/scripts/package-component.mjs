#!/usr/bin/env node
import { chmod, copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const stageInput = process.env.OPENADAM_COMPONENT_STAGE;
if (typeof stageInput !== "string" || stageInput.length === 0) {
  throw new Error("OPENADAM_COMPONENT_STAGE is required; run this command through openadam-dev pack");
}
const stage = resolve(stageInput);
const info = await stat(stage);
if (!info.isDirectory() || (await readdir(stage)).length !== 0) {
  throw new Error("OPENADAM_COMPONENT_STAGE must be one empty directory");
}

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginId = "batch-delivery-preflight";
const marketplaceRoot = join(stage, "marketplace");
const pluginRoot = join(marketplaceRoot, "plugins", pluginId);

async function copy(source, destination, mode) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  if (mode !== undefined) {
    await chmod(destination, mode);
  }
}

async function copyFromProject(source, destination, mode) {
  await copy(join(project, source), destination, mode);
}

const adapterSource = join(project, "bin", "capability-adapter");
const adapterInfo = await stat(adapterSource).catch(() => null);
if (adapterInfo === null || !adapterInfo.isFile()) {
  throw new Error("bin/capability-adapter is missing; run scripts/build-file-vitals.sh before pack");
}

const assetDelivery = join(project, "../asset-delivery-preflight/preflight.mjs");
const channelCover = join(project, "../channel-cover-preflight");
await stat(assetDelivery);
await stat(join(channelCover, "src/preflight.mjs"));

await mkdir(join(marketplaceRoot, ".agents", "plugins"), { recursive: true });
await mkdir(join(pluginRoot, ".codex-plugin"), { recursive: true });
await mkdir(join(pluginRoot, "skills", pluginId), { recursive: true });
await mkdir(join(pluginRoot, "runtime"), { recursive: true });
await mkdir(join(pluginRoot, "bin"), { recursive: true });
await mkdir(join(pluginRoot, "src"), { recursive: true });
await mkdir(join(pluginRoot, "lib"), { recursive: true });
await mkdir(join(pluginRoot, "deps/asset-delivery-preflight"), { recursive: true });
await mkdir(join(pluginRoot, "deps/channel-cover-preflight/src"), { recursive: true });
await mkdir(join(pluginRoot, "deps/channel-cover-preflight/lib"), { recursive: true });

await writeFile(join(marketplaceRoot, ".agents", "plugins", "marketplace.json"), `${JSON.stringify({
  name: "private-batch-delivery-preflight",
  interface: { displayName: "Batch delivery preflight" },
  plugins: [{
    name: pluginId,
    source: { source: "local", path: `./plugins/${pluginId}` },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  }],
}, null, 2)}\n`);

await copyFromProject(`plugins/${pluginId}/.codex-plugin/plugin.json`, join(pluginRoot, ".codex-plugin", "plugin.json"));
await copyFromProject(`plugins/${pluginId}/.mcp.json`, join(pluginRoot, ".mcp.json"));
await copyFromProject(`plugins/${pluginId}/skills/${pluginId}/SKILL.md`, join(pluginRoot, "skills", pluginId, "SKILL.md"));
await copyFromProject("src/mcp-server.mjs", join(pluginRoot, "runtime", "mcp-server.mjs"), 0o755);
for (const name of ["preflight.mjs", "spec.mjs", "lower.mjs", "cli.mjs", "mcp-server.mjs"]) {
  await copyFromProject(`src/${name}`, join(pluginRoot, "src", name));
}
await copyFromProject("lib/workspace.mjs", join(pluginRoot, "lib", "workspace.mjs"));
await copyFromProject("bin/capability-adapter", join(pluginRoot, "bin", "capability-adapter"), 0o755);

await copy(assetDelivery, join(pluginRoot, "deps/asset-delivery-preflight/preflight.mjs"));
for (const name of ["preflight.mjs", "spec.mjs", "compare.mjs"]) {
  await copy(join(channelCover, "src", name), join(pluginRoot, "deps/channel-cover-preflight/src", name));
}
for (const name of [
  "observe-file-inspect.mjs",
  "list-delivery-files.mjs",
  "check-record.mjs",
  "spec-base.mjs",
  "workspace.mjs",
]) {
  await copy(join(channelCover, "lib", name), join(pluginRoot, "deps/channel-cover-preflight/lib", name));
}

for (const name of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.txt", "sbom.spdx.json"]) {
  await copyFromProject(name, join(stage, name));
}

process.stdout.write("Staged Agent Host component payload\n");
