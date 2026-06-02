import type { ApolloCache } from "@apollo/client/cache";

import type { InMemoryCache } from "./inMemoryCache.js";

export class Scalar<TInput, TOutput> {
  private config: InMemoryCache.ScalarConfig<TInput, TOutput>;

  readonly devtools: ApolloCache.Scalar<TInput, TOutput>["devtools"];

  constructor(config: InMemoryCache.ScalarConfig<TInput, TOutput>) {
    this.config = config;

    this.parse = config.parse.bind(this);
    this.serialize = config.serialize.bind(this);

    this.devtools = {
      displayValue:
        config.devtools?.displayValue ??
        this.getDevtoolsDisplayValue.bind(this),
    };
  }

  parse: (value: TInput) => TOutput;
  serialize: (value: TOutput) => TInput;

  is(value: TInput | TOutput): value is TOutput {
    if (this.config.is) {
      return this.config.is(value);
    }

    return typeof value === "object" && value !== null;
  }

  private getDevtoolsDisplayValue(value: TOutput) {
    return this.serialize(value);
  }
}
