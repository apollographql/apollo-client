import { addResolversToSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";

import type { Resolvers } from "../../core/types.js";

interface ProxiedSchemaFns {
  addResolvers: (newResolvers: Resolvers) => GraphQLSchema;
  forkWithResolvers: (newResolvers: Resolvers) => GraphQLSchema;
  reset: () => void;
  fork: () => GraphQLSchema;
}

const proxiedSchema = (
  schemaWithMocks: GraphQLSchema,
  resolvers: Resolvers
): GraphQLSchema & ProxiedSchemaFns => {
  let targetSchema = addResolversToSchema({
    schema: schemaWithMocks,
    resolvers,
  });

  const fns: ProxiedSchemaFns = {
    addResolvers: (newResolvers: typeof resolvers) =>
      (targetSchema = addResolversToSchema({
        schema: targetSchema,
        resolvers: {
          ...resolvers,
          ...newResolvers,
        },
      })),
    forkWithResolvers: (newResolvers: typeof resolvers) => {
      return proxiedSchema(targetSchema, newResolvers);
    },
    fork: () => {
      return proxiedSchema(targetSchema, {});
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

      // this binds `this` to the right schema - without it, the new schema
      // calls methods but with the wrong `this` context, from the previous
      // schema
      // @ts-ignore
      if (typeof targetSchema[p] === "function") {
        // @ts-ignore
        return targetSchema[p].bind(targetSchema);
      }

      return Reflect.get(targetSchema, p);
    },
  });

  return schema as GraphQLSchema & ProxiedSchemaFns;
};

export { proxiedSchema };
