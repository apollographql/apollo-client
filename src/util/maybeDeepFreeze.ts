import * as deepFreeze from 'deep-freeze';

export default function maybeDeepFreeze(obj: any) {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return deepFreeze(obj);
  }
  return obj;
}
