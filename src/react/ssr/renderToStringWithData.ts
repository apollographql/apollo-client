import type { ReactElement } from 'react';
import { getMarkupFromTree } from './getDataFromTree.js';
import { renderToString } from 'react-dom/server.js';

export function renderToStringWithData(
  component: ReactElement<any>
): Promise<string> {
  return getMarkupFromTree({
    tree: component,
    renderFunction: renderToString
  });
}
