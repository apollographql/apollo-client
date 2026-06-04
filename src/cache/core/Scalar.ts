import type { NoInfer } from "@apollo/client/utilities/internal";

export declare namespace Scalar {
  export interface Options<TSerialized, TParsed> {
    // We use method syntax to ensure the functions are bivariant. This lets
    // users declare scalars using
    // `extends Record<string, { serialized: unknown; parsed: unknown }>` while
    // allowing specific scalar overrides.
    parse(serializedValue: TSerialized): NoInfer<TParsed>;
    serialize(parsedValue: TParsed): NoInfer<TSerialized>;
    // Since we have a conditional type here, we can't use method syntax
    // directly. This hack allows us to maintain bivariance.
    is?(value: TSerialized | TParsed): boolean;
    // is?: IsLooselyEqual<TSerialized, TParsed> extends true ?
    //   { _(value: TSerialized | TParsed): boolean }["_"]
    // : { _(value: TSerialized | TParsed): value is TParsed }["_"];
  }
}

export class Scalar<TSerialized, TParsed> {
  private options: Scalar.Options<TSerialized, TParsed>;

  constructor(options: Scalar.Options<TSerialized, TParsed>) {
    this.options = options;
  }

  parse(value: TSerialized): TParsed {
    return this.options.parse(value);
  }

  serialize(value: TParsed): TSerialized {
    return this.options.serialize(value);
  }

  is(value: TSerialized | TParsed): value is TParsed {
    if (this.options.is) {
      return this.options.is(value);
    }

    return typeof value === "object" && value !== null;
  }
}
