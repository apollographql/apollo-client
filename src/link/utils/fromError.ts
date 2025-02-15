import { Observable } from "rxjs";

export function fromError<T>(errorValue: any) {
  return new Observable<T>((observer) => {
    observer.error(errorValue);
  });
}
