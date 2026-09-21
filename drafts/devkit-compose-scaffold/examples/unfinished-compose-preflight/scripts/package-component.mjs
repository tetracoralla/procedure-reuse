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
const pluginId = "unfinished-compose-preflight";
const marketplaceRoot = join(stage, "marketplace");
const pluginRoot = join(marketplaceRoot, "plugins", pluginId);

async function copy(source, destination, mode) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(project, source), destination);
  if (mode !== undefined) {
    await chmod(destination, mode);
  }
}

const adapterSource = join(project, "bin", "capability-adapter");
const adapterInfo = await stat(adapterSource).catch(() => null);
if (adapterInfo === null || !adapterInfo.isFile()) {
  throw new Error("bin/capability-adapter is missing; run scripts/build-file-vitals.sh before pack");
}

await mkdir(join(marketplaceRoot, ".agents", "plugins"), { recursive: true });
await mkdir(join(pluginRoot, ".codex-plugin"), { recursive: true });
await mkdir(join(pluginRoot, "skills", pluginId), { recursive: true });
await mkdir(join(pluginRoot, "runtime"), { recursive: true });
await mkdir(join(pluginRoot, "bin"), { recursive: true });
await mkdir(join(pluginRoot, "src"), { recursive: true });
await mkdir(join(pluginRoot, "lib"), { recursive: true });

await writeFile(join(marketplaceRoot, ".agents", "plugins", "marketplace.json"), `${JSON.stringify({
  name: "private-unfinished-compose-preflight",
  interface: { displayName: "Unfinished compose preflight" },
  plugins: [{
    name: pluginId,
    source: { source: "local", path: `./plugins/${pluginId}` },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  }],
}, null, 2)}\n`);

await copy(`plugins/${pluginId}/.codex-plugin/plugin.json`, join(pluginRoot, ".codex-plugin", "plugin.json"));
await copy(`plugins/${pluginId}/.mcp.json`, join(pluginRoot, ".mcp.json"));
await copy(`plugins/${pluginId}/skills/${pluginId}/SKILL.md`, join(pluginRoot, "skills", pluginId, "SKILL.md"));
await copy("src/mcp-server.mjs", join(pluginRoot, "runtime", "mcp-server.mjs"), 0o755);
for (const name of ["preflight.mjs", "spec.mjs", "compare.mjs", "cli.mjs"]) {
  await copy(`src/${name}`, join(pluginRoot, "src", name));
}
for (const name of [
  "observe-file-inspect.mjs",
  "list-delivery-files.mjs",
  "check-record.mjs",
  "spec-base.mjs",
  "workspace.mjs",
]) {
  await copy(`lib/${name}`, join(pluginRoot, "lib", name));
}
await copy("bin/capability-adapter", join(pluginRoot, "bin", "capability-adapter"), 0o755);

for (const name of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.txt", "sbom.spdx.json"]) {
  await copy(name, join(stage, name));
}

process.stdout.write("Staged Agent Host component payload\n");
