import type { GraphQLScalarType } from "graphql";

import type { NoInfer } from "@apollo/client/utilities/internal";

export declare namespace Scalar {
  export interface Options<TSerialized, TParsed> {
    // We use method syntax to ensure the functions are bivariant. This lets
    // users declare scalars using
    // `extends Record<string, { serialized: unknown; parsed: unknown }>` while
    // allowing specific scalar overrides.
    parse(serializedValue: TSerialized): NoInfer<TParsed>;
    serialize(parsedValue: TParsed): NoInfer<TSerialized>;
    is?(value: TSerialized | TParsed): boolean;
  }
}

export class Scalar<TSerialized, TParsed> {
  private options: Scalar.Options<TSerialized, TParsed>;

  static fromGraphQLScalarType<TSerialized, TParsed>(
    scalarType: GraphQLScalarType<TParsed, TSerialized>,
    options?: Pick<Scalar.Options<NoInfer<TSerialized>, NoInfer<TParsed>>, "is">
  ): Scalar<TSerialized, TParsed> {
    return new Scalar<TSerialized, TParsed>({
      ...options,
      parse: scalarType.parseValue,
      serialize: scalarType.serialize,
    });
  }

  constructor(options: Scalar.Options<TSerialized, TParsed>) {
    this.options = options;
  }

  parse(value: TSerialized): TParsed {
    return this.options.parse(value);
  }

  serialize(value: TParsed): TSerialized {
    return this.options.serialize(value);
  }

  coerceToParsed(value: TSerialized | TParsed): TParsed {
    return this.is(value) ? value : this.parse(value);
  }

  coerceToSerialized(value: TSerialized | TParsed): TSerialized {
    return this.is(value) ? this.serialize(value) : value;
  }

  is(value: TSerialized | TParsed): value is TParsed {
    if (this.options.is) {
      return this.options.is(value);
    }

    return typeof value === "object" && value !== null;
  }
}
