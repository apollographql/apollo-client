import type { GraphQLSchema } from "graphql";
import { addResolversToSchema } from "@graphql-tools/schema";
import { mergeResolvers } from "@graphql-tools/merge";
import { createMockSchema } from "./graphql-tools/utils.js";
import type { Resolvers } from "../../core/types.js";

type ProxiedSchema = GraphQLSchema & TestSchemaFns;

interface TestSchemaFns {
  add: (addOptions: { resolvers: Resolvers }) => ProxiedSchema;
  fork: (forkOptions?: { resolvers?: Resolvers }) => ProxiedSchema;
  reset: () => void;
}

interface TestSchemaOptions {
  resolvers: Resolvers;
  scalars?: { [key: string]: any };
}

/**
 * A function that creates a [Proxy object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
 * around a given `schema` with `resolvers`. This proxied schema can be used to
 * progressively layer resolvers on top of the original schema using the `add`
 * method. The `fork` method can be used to create a new proxied schema which
 * can be modified independently of the original schema. `reset` will restore
 * resolvers to the original proxied schema.
 *
 * @param schema - A `GraphQLSchema`.
 * @param options - An `options` object that accepts `scalars` and `resolvers` objects.
 * @returns A `ProxiedSchema` with `add`, `fork` and `reset` methods.
 *
 * @example
 * ```js
 *
 * const schema = createTestSchema(schemaWithTypeDefs, {
 *   resolvers: {
       Query: {
         writer: () => ({
           name: "Ada Lovelace",
         }),
       }
     },
     scalars: {
       ID: () => "1",
       Int: () => 36,
       String: () => "String",
       Date: () => new Date("December 10, 1815 01:00:00").toJSON().split("T")[0],
     }
   });
 * ```
 * @since 3.9.0
 * @alpha
 * @deprecated `createTestSchema` is deprecated and will be removed in 3.12.0.
 * Please migrate to [`@apollo/graphql-testing-library`](https://github.com/apollographql/graphql-testing-library).
 */
const createTestSchema = (
  schemaWithTypeDefs: GraphQLSchema,
  options: TestSchemaOptions
): ProxiedSchema => {
  let targetResolvers = { ...options.resolvers };
  let targetSchema = addResolversToSchema({
    schema: createMockSchema(schemaWithTypeDefs, options.scalars ?? {}),
    resolvers: targetResolvers,
  });

  const fns: TestSchemaFns = {
    add: ({ resolvers: newResolvers }) => {
      // @ts-ignore TODO(fixme): IResolvers type does not play well with our Resolvers
      targetResolvers = mergeResolvers([targetResolvers, newResolvers]);

      targetSchema = addResolversToSchema({
        schema: targetSchema,
        resolvers: targetResolvers,
      });

      return targetSchema as ProxiedSchema;
    },

    fork: ({ resolvers: newResolvers } = {}) => {
      return createTestSchema(targetSchema, {
        // @ts-ignore TODO(fixme): IResolvers type does not play well with our Resolvers
        resolvers:
          mergeResolvers([targetResolvers, newResolvers]) ?? targetResolvers,
        scalars: options.scalars,
      });
    },

    reset: () => {
      targetSchema = addResolversToSchema({
        schema: schemaWithTypeDefs,
        resolvers: options.resolvers,
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
