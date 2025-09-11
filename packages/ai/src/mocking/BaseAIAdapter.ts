import { ApolloLink } from "@apollo/client";
import { AIAdapter } from "./AIAdapter.js";
import { print } from "graphql";
import { BASE_SYSTEM_PROMPT } from "./consts.js";
import { GrowingSchema } from "./GrowingSchema/index.js";

export class BaseAIAdapter {
  private static baseSystemPrompt = BASE_SYSTEM_PROMPT;
  private schema: GrowingSchema;

  constructor(private implementation: AIAdapter) {
    this.schema = new GrowingSchema();
  }

  /**
   * Performs a query using the implementation adapter.
   * @param operation - The operation to perform.
   * @returns The result of the query.
   */
  public async performQuery(
    operation: ApolloLink.Operation
  ): Promise<AIAdapter.Result> {
    const systemPrompt = BaseAIAdapter.createSystemPrompt(
      this.implementation.systemPrompt
    );

    const prompt = BaseAIAdapter.createPrompt(operation);

    const result = await this.implementation.generateObject(
      prompt,
      systemPrompt
    );

    this.schema.add(operation, result);

    return result;
  }

  /**
   * Creates a system prompt from the base system prompt and the provided prompt.
   * @param prompt - The prompt to add to the base system prompt.
   * @returns The system prompt.
   */
  private static createSystemPrompt(prompt?: string) {
    return [BaseAIAdapter.baseSystemPrompt, prompt]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Creates a prompt from the operation.
   * @param operation - The operation to create a prompt from.
   * @returns The prompt.
   */
  private static createPrompt(operation: ApolloLink.Operation): string {
    const { query, variables } = operation;
    const providedPrompt = operation.getContext().prompt;

    // Try to get the GraphQL query document string
    // from the AST location if available, otherwise
    // use the `print` function to get the query string.
    //
    // The AST location may not be available if the query
    // was parsed with the `noLocation: true` option.
    //
    // If the query document string is available through
    // the AST location, it will save some processing time
    // over the `print` function.
    const queryString = query?.loc?.source?.body ?? print(query);

    const promptParts = [
      "Give me mock data that fulfills this query:",
      "```graphql",
      queryString,
      "```",
    ];

    if (variables) {
      promptParts.push(
        "\n",
        "```json",
        JSON.stringify(variables, null, 2),
        "```"
      );
    }

    if (providedPrompt) {
      promptParts.push("\n", "Additional instructions:", providedPrompt);
    }

    return promptParts.join("\n");
  }
}
