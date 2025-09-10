import { Subject } from "rxjs";

export function asyncIterableSubject<T>() {
  const subject = new Subject<T>();

  const stream = new ReadableStream<T>({
    start: (controller) => {
      subject.subscribe({
        next: (value) => controller.enqueue(value),
        complete: () => controller.close(),
      });
    },
  });

  return { subject, stream };
}
