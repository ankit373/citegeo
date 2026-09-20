import type { ProductBaselineService } from "../configuration/baseline-service.js";
import type { RecognitionAnswerExecutor } from "../recognition/recognition-service.js";
import type { StructuredAsk } from "./topic-service.js";
import { sha256 } from "../../utils/hash.js";
import { readStructuredValue } from "./structured-value.js";

/** Runs on the first model the project already saved, so a proposal costs what
 * the user has already agreed to and no default is reached for silently. */
export function createStructuredAsk(input: {
  baselines: ProductBaselineService;
  executor: RecognitionAnswerExecutor;
}): StructuredAsk {
  return async (request) => {
    const baselines = await input.baselines.list(request.projectId);
    const baseline = baselines[0];
    if (!baseline) {
      throw new Error("This project has no saved configuration, so there is no model to ask. Choose models and save one first.");
    }
    const model = baseline.modelSnapshots[0];
    if (!model) {
      throw new Error("The saved configuration has no models in it.");
    }
    const result = await input.executor.execute({
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
      structuredOutput: {
        name: request.schemaName,
        description: request.schemaDescription,
        schema: request.schema,
      },
    });
    if (!result.structuredOutput) {
      throw new Error("The model returned no structured payload, so there is nothing to read as a prompt set.");
    }
    const parsed = readStructuredValue(result.structuredOutput.value);
    if (parsed === null) throw new Error("The model's structured payload was not readable as JSON.");
    return parsed;
  };
}
