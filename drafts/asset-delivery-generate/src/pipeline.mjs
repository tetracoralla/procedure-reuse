/**
 * Generate PNG slots, then run the existing asset-delivery preflight.
 *
 * Generate failures and preflight failures are separate stages.
 * Preflight comparison is not copied here.
 */
import { generateReportFromFailure, GenerateFailure, GENERATOR, runGenerate } from "./generate.mjs";
import { loadLower, resolveAdapter } from "./lower.mjs";

function failedIdsFromGenerate(generate) {
  return [...new Set((generate.failures ?? []).map((item) => item.id))];
}

export async function runGenerateThenPreflight({
  spec,
  source,
  out,
  overwrite = false,
  adapter = null,
  generateOnly = false,
}) {
  let generate;
  try {
    generate = await runGenerate({ spec, source, out, overwrite });
  } catch (error) {
    if (error instanceof GenerateFailure) {
      generate = generateReportFromFailure(error);
      return {
        status: "fail",
        stage: "generate",
        generator: GENERATOR,
        source: generate.source,
        output: generate.output,
        generate,
        preflight: null,
        summary: {
          stage: "generate",
          generateStatus: "fail",
          preflightStatus: null,
          failedIds: failedIdsFromGenerate(generate),
        },
      };
    }
    throw error;
  }

  if (generateOnly) {
    return {
      status: "pass",
      stage: "generate",
      generator: GENERATOR,
      source: generate.source,
      output: generate.output,
      generate,
      preflight: null,
      summary: {
        stage: "generate",
        generateStatus: "pass",
        preflightStatus: null,
        failedIds: [],
      },
    };
  }

  const lower = await loadLower();
  const resolvedAdapter = adapter ?? (await resolveAdapter());
  const preflight = await lower.runPreflight({
    spec,
    root: generate.output.root,
    adapter: resolvedAdapter,
    workspaceRoot: generate.output.root,
  });

  return {
    status: preflight.status,
    stage: "preflight",
    generator: GENERATOR,
    source: generate.source,
    output: generate.output,
    generate,
    preflight,
    summary: {
      stage: "preflight",
      generateStatus: "pass",
      preflightStatus: preflight.status,
      failedIds: preflight.summary?.failedIds ?? [],
      preflightFailed: preflight.summary?.failed ?? 0,
    },
  };
}
