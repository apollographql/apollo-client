import { addResolversToSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";

import type { Resolvers } from "../../core/types.js";

type ProxiedSchema = GraphQLSchema & ProxiedSchemaFns;

interface ProxiedSchemaFns {
  add: (addOptions: { resolvers: Resolvers }) => ProxiedSchema;
  fork: (forkOptions?: { resolvers?: Resolvers }) => ProxiedSchema;
  reset: () => void;
}

/**
 * A function that creates a [Proxy object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
 * around a given `schema` with `resolvers`. This proxied schema can be used to
 * progressively layer resolvers on top of the original schema using the `add`
 * method. The `fork` method can be used to create a new proxied schema which
 * can be modified independently of the original schema. `reset` will restore
 * resolvers to the original proxied schema.
 *
 * @param schemaWithMocks - A `GraphQLSchema`.
 * @param resolvers - `Resolvers` object.
 * @returns A `ProxiedSchema` with `add`, `fork` and `reset` methods.
 *
 * @example
 * ```js
 * const schemaWithMocks = createMockSchema(schemaWithTypeDefs, {
     ID: () => "1",
     Int: () => 36,
     String: () => "String",
     Date: () => new Date("December 10, 1815 01:00:00").toJSON().split("T")[0],
   });
 *
 * const schema = createTestSchema(schemaWithMocks, {
     Query: {
       writer: () => ({
         name: "Ada Lovelace",
       }),
     }
   });
 * ```
 * @since 3.9.0
 * @alpha
 */
const createTestSchema = (
  schemaWithMocks: GraphQLSchema,
  resolvers: Resolvers
): ProxiedSchema => {
  let targetResolvers = { ...resolvers };
  let targetSchema = addResolversToSchema({
    schema: schemaWithMocks,
    resolvers: targetResolvers,
  });

  const fns: ProxiedSchemaFns = {
    add: ({ resolvers: newResolvers }) => {
      targetResolvers = { ...targetResolvers, ...newResolvers };
      targetSchema = addResolversToSchema({
        schema: targetSchema,
        resolvers: targetResolvers,
      });

      return targetSchema as ProxiedSchema;
    },

    fork: ({ resolvers: newResolvers } = {}) => {
      return createTestSchema(targetSchema, newResolvers ?? targetResolvers);
    },

    reset: () => {
      targetSchema = addResolversToSchema({
        schema: schemaWithMocks,
        resolvers,
      });
    },
  };

  const schema = new Proxy(targetSchema, {
    get(_target, p) {
      if (p in fns) {
        return Reflect.get(fns, p);
      }

      // An optimization that eliminates round-trips through the proxy
      // on class methods invoked via `this` on a base class instance wrapped by
      // the proxy.
      //
      // For example, consider the following class:
      //
      // class Base {
      //   foo(){
      //     this.bar()
      //   }
      //   bar(){
      //     ...
      //   }
      // }
      //
      // Calling `proxy.foo()` would call `foo` with `this` being the proxy.
      // This would result in calling `proxy.bar()` which would again invoke
      // the proxy to resolve `bar` and call that method.
      //
      // Instead, calls to `proxy.foo()` should result in a call to
      // `innerObject.foo()` with a `this` of `innerObject`, and that call
      // should directly call `innerObject.bar()`.

      const property = Reflect.get(targetSchema, p);
      if (typeof property === "function") {
        return property.bind(targetSchema);
      }
      return property;
    },
  });

  return schema as ProxiedSchema;
};

export { createTestSchema };
