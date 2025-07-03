import type { DefaultContext } from "@apollo/client";

export interface ContextValue extends DefaultContext {
  env: "dev" | "prod";
}
