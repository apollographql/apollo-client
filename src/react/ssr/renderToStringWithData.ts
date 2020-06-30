import { ReactElement } from 'react';
import { getMarkupFromTree } from './getDataFromTree';

export function renderToStringWithData(
  component: ReactElement<any>
): Promise<string> {
  return getMarkupFromTree({
    tree: component,
    renderFunction: require('react-dom/server').renderToString
  });
}
