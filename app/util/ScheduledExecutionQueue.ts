interface QueuedItem<T> {
  sendAt: Date;
  item: T;
}

export class ScheduledExecutionQueue<T> {
  private queue: Array<QueuedItem<T>> = [];
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private processor: (item: T) => boolean | Promise<boolean>) {}

  resume(): void {
    this.processQueue();
  }

  add(item: T, sendAt: Date): void {
    this.queue.push({ item, sendAt });
    this.queue.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
    this.triggerTimer();
  }

  clear(): void {
    this.queue = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.clear();
  }

  private triggerTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;

    const nextItem = this.queue[0];
    const delay = nextItem.sendAt.getTime() - Date.now();

    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.processQueue();
    }, Math.max(delay, 0));
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    try {
      const now = new Date();
      while (this.queue.length > 0 && this.queue[0]?.sendAt <= now) {
        const item = this.queue[0];
        const success = await this.processor(item.item);

        if (success) {
          this.queue.shift();
        } else {
          // 処理に失敗したため、後続の処理も中断し、resume() を待つ
          return;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    // 処理可能なアイテムがすべて完了した後、次のアイテムのタイマーを設定する
    this.triggerTimer();
  }
}
