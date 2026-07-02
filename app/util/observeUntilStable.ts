import { Observable } from 'rxjs';
import { debounceTime, filter, take, timeout } from 'rxjs/operators';

/**
 * source$ の中から isReady を満たす値を待ち、最後にその値が来てから
 * debounceMs 経過して値が安定するまで待ってから resolve する。
 * timeoutMs 以内に安定しなければ reject する。
 */
export function observeUntilStable<T>(
  source$: Observable<T>,
  isReady: (value: T) => boolean,
  options: { timeoutMs: number; debounceMs: number },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const subscription = source$
      .pipe(
        filter(isReady),
        debounceTime(options.debounceMs),
        timeout(options.timeoutMs),
        take(1),
      )
      .subscribe({
        next: (value) => {
          subscription.unsubscribe();
          resolve(value);
        },
        error: (error) => {
          subscription.unsubscribe();
          reject(error);
        },
      });
  });
}
