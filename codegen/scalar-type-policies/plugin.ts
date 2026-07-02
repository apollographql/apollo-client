import type {
  PluginFunction,
  PluginValidateFn,
} from "@graphql-codegen/plugin-helpers";

import type { ScalarTypePoliciesPluginConfig } from "./config.js";

export const plugin: PluginFunction<
  ScalarTypePoliciesPluginConfig,
  string
> = () => {
  return "";
};

export const validate: PluginValidateFn<
  ScalarTypePoliciesPluginConfig
> = () => {};
