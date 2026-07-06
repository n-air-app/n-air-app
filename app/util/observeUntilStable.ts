import { Observable, Subscription } from 'rxjs';
import { debounceTime, filter, take, timeout } from 'rxjs/operators';

/**
 * source$ の中から isReady を満たす値を待ち、最後にその値が来てから
 * debounceMs 経過して値が安定するまで待ってから resolve する。
 * timeoutMs 以内に安定しなければ、または isReady を満たす値を出さずに
 * source$ が complete した場合は reject する。
 */
export function observeUntilStable<T>(
  source$: Observable<T>,
  isReady: (value: T) => boolean,
  options: { timeoutMs: number; debounceMs: number },
): Promise<T> {
  return new Promise((resolve, reject) => {
    // next/error/complete は subscribe() の呼び出し中に同期的に発火する可能性があり、
    // その時点では subscription への代入がまだ完了していない。let で事前宣言することで
    // TDZ(参照前アクセスによるReferenceError)を避け、settled フラグで二重解決
    // (take(1)のnext直後に同期発火するcomplete等)も防ぐ。
    let subscription: Subscription | undefined;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      fn();
    };

    subscription = source$
      .pipe(
        filter(isReady),
        debounceTime(options.debounceMs),
        timeout(options.timeoutMs),
        take(1),
      )
      .subscribe({
        next: (value) => finish(() => resolve(value)),
        error: (error) => finish(() => reject(error)),
        complete: () =>
          finish(() =>
            reject(new Error('observeUntilStable: source completed without becoming ready')),
          ),
      });
  });
}
