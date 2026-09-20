import type { ProductBaseline, ProductModelSnapshot } from "../configuration/baseline-schema.js";
import type { ProductBaselineService } from "../configuration/baseline-service.js";
import type { RecognitionAnswerExecutor } from "../recognition/recognition-service.js";
import type { StructuredAsk } from "./topic-service.js";
import { sha256 } from "../../utils/hash.js";
import { readStructuredValue } from "./structured-value.js";
import { currentBaseline } from "../configuration/current-baseline.js";

interface AskRequest {
  prompt: string;
  schemaName: string;
  schemaDescription: string;
  schema: Record<string, unknown>;
}

/** Runs on the project's own saved models, so a proposal costs what the user
 * has already agreed to and no default is reached for silently. */
export function createStructuredAsk(input: {
  baselines: ProductBaselineService;
  executor: RecognitionAnswerExecutor;
}): StructuredAsk {
  return async (request) => {
    const baseline = currentBaseline(await input.baselines.list(request.projectId));
    if (!baseline) {
      throw new Error("This project has no saved configuration, so there is no model to ask. Choose models and save one first.");
    }
    if (!baseline.modelSnapshots.length) throw new Error("The saved configuration has no models in it.");

    // Tried in order rather than taking the first: a configuration can hold
    // sixteen models where only the last few are reachable, and failing on
    // number one reported the whole project as broken.
    const failures: string[] = [];
    for (const model of baseline.modelSnapshots) {
      try {
        return await askOne(input.executor, baseline, model, request);
      } catch (error) {
        failures.push(`${model.modelId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new Error(`No configured model could answer. ${failures.length} tried. ${failures.slice(0, 3).join(" | ")}`);
  };
}

async function askOne(
  executor: RecognitionAnswerExecutor,
  baseline: ProductBaseline,
  model: ProductModelSnapshot,
  request: AskRequest,
): Promise<unknown> {
  const result = await executor.execute({
    baseline,
    modelSnapshot: model,
    prompt: request.prompt,
    requestParameters: {
      model: model.modelId,
      temperature: 0,
      maxTokens: 4000,
      responseSchemaName: request.schemaName,
      responseSchemaHash: sha256(JSON.stringify(request.schema)),
      structuredOutputTransport: "response_json_schema",
      requireProviderParameters: false,
      // Proposing questions needs no web access, and asking for it would make
      // a run fail on every model that cannot search.
      webSearchEnabled: false,
      webSearchMode: "off",
    },
    structuredOutput: { name: request.schemaName, description: request.schemaDescription, schema: request.schema },
  });
  if (!result.structuredOutput) throw new Error("The model returned no structured payload.");
  const parsed = readStructuredValue(result.structuredOutput.value);
  if (parsed === null) throw new Error("The structured payload was not readable as JSON.");
  return parsed;
}
