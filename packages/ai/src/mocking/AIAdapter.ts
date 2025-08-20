import { ApolloLink } from "@apollo/client";
import { print } from "graphql";
import { BASE_SYSTEM_PROMPT } from "./consts.js";

export declare namespace AIAdapter {
  export interface Options {
    systemPrompt?: string;
  }

  export type Result = ApolloLink.Result;
}

export abstract class AIAdapter {
  public providedSystemPrompt: string | undefined;
  protected systemPrompt: string;

  constructor(options: AIAdapter.Options = {}) {
    this.systemPrompt = BASE_SYSTEM_PROMPT;
    if (options.systemPrompt) {
      this.providedSystemPrompt = options.systemPrompt;
      this.systemPrompt += `\n\n${this.providedSystemPrompt}`;
    }
  }

  public generateResponseForOperation(
    operation: ApolloLink.Operation,
    prompt: string
  ): Promise<AIAdapter.Result> {
    return Promise.resolve({ data: null });
  }

  protected createPrompt(
    { query, variables }: ApolloLink.Operation,
    prompt: string
  ): string {
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

    let promptVariables = "";
    if (variables) {
      promptVariables = `

    With variables:
    \`\`\`json
    ${JSON.stringify(variables, null, 2)}
    \`\`\``;
    }

    return `Give me mock data that fulfills this query:
    \`\`\`graphql
    ${queryString}
    \`\`\`
    ${promptVariables}
    ${prompt ? `\nAdditional instructions:\n${prompt}` : ""}
    `;
  }
}
