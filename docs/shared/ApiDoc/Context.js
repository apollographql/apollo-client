import { useMDXComponents } from "@mdx-js/react";

export const useApiDocContext = function () {
  const MDX = useMDXComponents();
  return MDX.useApiDocContext(this, arguments);
};
