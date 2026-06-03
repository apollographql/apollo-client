import type { ApolloCache } from "@apollo/client/cache";

import type { InMemoryCache } from "./inMemoryCache.js";

export class Scalar<TSerialized, TParsed> {
  private config: InMemoryCache.ScalarConfig<TSerialized, TParsed>;

  readonly devtools: ApolloCache.Scalar<TSerialized, TParsed>["devtools"];

  constructor(config: InMemoryCache.ScalarConfig<TSerialized, TParsed>) {
    this.config = config;

    this.parse = config.parse.bind(this);
    this.serialize = config.serialize.bind(this);

    this.devtools = {
      displayValue:
        config.devtools?.displayValue ??
        this.getDevtoolsDisplayValue.bind(this),
    };
  }

  parse: (value: TSerialized) => TParsed;
  serialize: (value: TParsed) => TSerialized;

  is(value: TSerialized | TParsed): value is TParsed {
    if (this.config.is) {
      return this.config.is(value);
    }

    return typeof value === "object" && value !== null;
  }

  private getDevtoolsDisplayValue(value: TParsed) {
    return this.serialize(value);
  }
}
