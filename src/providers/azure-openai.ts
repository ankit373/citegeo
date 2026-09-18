import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../core/types.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

// Azure puts the deployment in the path and the key in an api-key header, so
// the endpoint cannot be fixed at construction the way other providers are.
export class AzureOpenAIProvider implements AnswerProvider {
  readonly definition: ProviderDefinition;

  constructor(
    definition: ProviderDefinition,
    private readonly endpoint: string,
    private readonly apiVersion: string,
  ) {
    this.definition = definition;
  }

  run(input: ProviderRunInput): Promise<AnswerResult> {
    let base = this.endpoint.trim();
    while (base.endsWith("/")) base = base.slice(0, -1);
    if (!base) throw new Error('Missing AZURE_OPENAI_ENDPOINT for provider "azure-openai".');
    // The model id is an Azure deployment name, not a published model name.
    const url = `${base}/openai/deployments/${encodeURIComponent(input.model)}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;
    return new OpenAICompatibleProvider({
      definition: this.definition,
      endpoint: url,
      endpointKind: "custom_gateway",
      authHeader: "api-key",
    }).run(input);
  }
}
