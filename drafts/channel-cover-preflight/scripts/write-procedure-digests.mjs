#!/usr/bin/env node
/**
 * Fill implementation-manifest.json profile/schema digests from the current
 * draft Procedure files. Does not write public catalogs.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveProcedureContractsSrc } from "../lib/workspace.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "..");
const PROCEDURE_CONTRACTS = await resolveProcedureContractsSrc(PROJECT);
const { loadJson, procedureProfileDigest, resolveProcedureSchemas, schemaDigest } = await import(
  pathToFileURL(join(PROCEDURE_CONTRACTS, "src/lib/contracts.mjs")).href
);

const profilePath = resolve(PROJECT, "procedure/profile.v0.1.json");
const manifestPath = resolve(PROJECT, "procedure/implementation-manifest.json");
const profile = await loadJson(profilePath);
const schemas = await resolveProcedureSchemas(profile, profilePath);
const profileDigest = await procedureProfileDigest(profile, profilePath);
const inputDigest = schemaDigest(schemas.input);
const outputDigest = schemaDigest(schemas.output);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.implementations) || manifest.implementations.length !== 1) {
  throw new Error("implementation-manifest.json must contain exactly one implementation");
}
manifest.implementations[0].profileDigest = profileDigest;
manifest.implementations[0].contractSchemaDigests = {
  input: inputDigest,
  output: outputDigest,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ profileDigest, input: inputDigest, output: outputDigest }, null, 2)}\n`);
