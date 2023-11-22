import * as React from "react";

export interface RenderContextValue {
  renderedComponents: React.ComponentType[];
}

const RenderContext = React.createContext<RenderContextValue | undefined>(
  undefined
);

export function RenderContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: RenderContextValue;
}) {
  const parentContext = useRenderContext();

  if (parentContext) {
    throw new Error("Profilers should not be nested in the same tree");
  }

  return (
    <RenderContext.Provider value={value}>{children}</RenderContext.Provider>
  );
}

export function useRenderContext() {
  return React.useContext(RenderContext);
}
