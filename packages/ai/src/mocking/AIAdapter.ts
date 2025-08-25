import { ApolloLink } from "@apollo/client";

export declare namespace AIAdapter {
  export interface Options {
    systemPrompt?: string;
  }

  export type Result = ApolloLink.Result;
}

export abstract class AIAdapter {
  public systemPrompt?: string;

  constructor(options?: AIAdapter.Options) {
    this.systemPrompt = options?.systemPrompt;
  }

  public abstract generateObject(
    prompt: string,
    systemPrompt: string
  ): Promise<AIAdapter.Result>;
}
