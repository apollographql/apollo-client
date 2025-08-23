import { type LanguageModel, generateObject } from "ai";
import { AIAdapter } from "@apollo/client-ai";
import { isFormattedExecutionResult } from "@apollo/client/utilities";

namespace VercelAIAdapter {
  export interface Options extends AIAdapter.Options {
    model: LanguageModel;
  }
}

type GenerateObjectOptions = {
  model: LanguageModel;
  mode: "json";
  prompt: string;
  system?: string;
  output: "no-schema";
};

export class VercelAIAdapter extends AIAdapter {
  public model: LanguageModel;

  constructor(options: VercelAIAdapter.Options) {
    super(options);

    this.model = options.model;
  }

  public async generateObject(
    prompt: string,
    systemPrompt: string
  ): Promise<AIAdapter.Result> {
    const promptOptions: GenerateObjectOptions = {
      mode: "json",
      model: this.model,
      prompt,
      system: systemPrompt,
      output: "no-schema",
    };

    return generateObject(promptOptions).then(
      ({ object: result, finishReason, usage, warnings }) => {
        if (!result || typeof result !== "object") {
          return { data: null };
        }
        // Type guard to ensure result is a valid FormattedExecutionResult
        if (isFormattedExecutionResult(result)) {
          return result;
        }
        // Fallback: wrap in data property if not a valid execution result
        return { data: result };
      }
    );
  }
}
