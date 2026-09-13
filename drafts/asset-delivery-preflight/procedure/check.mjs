#!/usr/bin/env node
/**
 * Validate the draft Procedure Profile, suite, and optional manifest
 * against procedure-contracts without touching the public catalog.
 *
 *   node procedure/check.mjs --digests
 *   node procedure/check.mjs
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCapabilityReferences } from "../../../repos/procedure-contracts/src/lib/capability-references.mjs";
import {
  loadJson,
  parseJson,
  procedureProfileDigest,
  resolveProcedureSchemas,
  schemaDigest,
  validateContractSet,
} from "../../../repos/procedure-contracts/src/lib/contracts.mjs";
import { validateStageProviderBindings } from "../../../repos/procedure-contracts/src/lib/stage-bindings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "../../..");
const profilePath = resolve(HERE, "asset-delivery-preflight.v0.1.json");
const suitePath = resolve(HERE, "conformance.v0.1.json");
const manifestPath = resolve(HERE, "implementation-manifest.json");
const capabilityCatalog = resolve(
  WORKSPACE,
  "repos/capability-contracts/catalog/capabilities",
);
const fileVitalsManifest = resolve(
  WORKSPACE,
  "repos/file-vitals/capabilities/provider.json",
);

async function readCatalogFiles(root, label) {
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const documents = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    const metadata = await stat(path);
    if (!metadata.isFile()) continue;
    documents.push(parseJson(await readFile(path, "utf8"), `${label} ${entry.name}`));
  }
  return documents;
}

const profile = await loadJson(profilePath);
const suite = await loadJson(suitePath);
const schemas = await resolveProcedureSchemas(profile, profilePath);
const profileDigest = await procedureProfileDigest(profile, profilePath);
const inputDigest = schemaDigest(schemas.input);
const outputDigest = schemaDigest(schemas.output);

if (process.argv.includes("--digests")) {
  process.stdout.write(`${JSON.stringify({
    profileDigest,
    input: inputDigest,
    output: outputDigest,
  }, null, 2)}\n`);
  process.exit(0);
}

const capabilities = await readCatalogFiles(capabilityCatalog, "Capability");
const refs = validateCapabilityReferences({
  capabilities,
  procedures: [profile],
});
process.stdout.write(
  `PASS capability-refs procedures=${refs.procedures} stages=${refs.stageReferences} capabilities=${refs.capabilitiesUsed}\n`,
);

const manifest = await loadJson(manifestPath);
const validated = await validateContractSet({
  profile,
  profilePath,
  manifest,
  suite,
});
process.stdout.write(
  `PASS contract-set ${profile.id}@${profile.version} claim=${suite.claimLevel} cases=${suite.cases.length}\n`,
);

const capabilityManifests = [await loadJson(fileVitalsManifest)];
const bindings = validateStageProviderBindings({
  profile,
  procedureManifest: manifest,
  capabilityManifests,
});
process.stdout.write(
  `PASS stage-provider-bindings stages=${bindings.stages} providers=${bindings.providers}\n`,
);

if (validated.implementation.profileDigest !== profileDigest) {
  throw new Error("internal: profile digest mismatch after validation");
}
if (validated.implementation.contractSchemaDigests.input !== inputDigest) {
  throw new Error("internal: input digest mismatch after validation");
}
if (validated.implementation.contractSchemaDigests.output !== outputDigest) {
  throw new Error("internal: output digest mismatch after validation");
}

process.stdout.write(`PASS draft procedure ${profile.id}@${profile.version}\n`);
