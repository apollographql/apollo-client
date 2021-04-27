import { HttpLink } from './HttpLink';
import { HttpOptions } from './selectHttpOptionsAndBody';

export function createHttpLink(options: HttpOptions = {}) {
  return new HttpLink(options);
}
