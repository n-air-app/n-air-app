import { Node } from './node';

interface IArraySchema<TSchema> {
  items: TSchema[];
}

export abstract class ArrayNode<TSchema, TContext, TItem> extends Node<
  IArraySchema<TSchema>,
  TContext
> {
  abstract saveItem(item: TItem, context: TContext): Promise<TSchema>;

  abstract loadItem(item: TSchema, context: TContext): Promise<(() => Promise<void>) | void>;

  abstract getItems(context: TContext): TItem[];

  async save(context: TContext): Promise<void> {
    const values = await Promise.all(
      this.getItems(context).map((item) => {
        return this.saveItem(item, context);
      }),
    );

    this.data = { items: values.filter(Boolean) };
  }

  async load(context: TContext): Promise<void> {
    this.clearLoadErrors();

    // Items skipped by parse() due to an unknown nodeType become holes
    // (null/undefined) in the array. Drop them before subclasses'
    // beforeLoad()/loadItem() see them (some getItemInfo() overrides would
    // themselves throw on a null item), and report the drop as a single
    // load error so it isn't silently lost -- this also covers a stray
    // null unrelated to a parse-time skip (e.g. hand-edited JSON).
    if (this.data.items) {
      const originalLength = this.data.items.length;
      this.data.items = this.data.items.filter((item) => item != null);
      const droppedCount = originalLength - this.data.items.length;
      if (droppedCount > 0) {
        const name = `${this.constructor.name}: ${droppedCount} unrecognized item(s)`;
        this.addLoadError({
          type: 'format',
          name,
          error: new Error(
            `${droppedCount} item(s) in ${this.constructor.name} could not be recognized and were skipped.`,
          ),
        });
      }
    }

    await this.beforeLoad(context);

    const afterLoadItemsCallbacks: (void | (() => Promise<void>))[] = [];

    if (!this.data.items) return;

    for (const item of this.data.items) {
      try {
        afterLoadItemsCallbacks.push(await this.loadItem(item, context));
      } catch (e) {
        console.error('Array node step failed', e);
        // ArrayNode subclasses should override getItemInfo to provide better error messages
        const itemInfo = this.getItemInfo(item);
        this.addLoadError({
          type: itemInfo.type,
          id: itemInfo.id,
          name: itemInfo.name,
          error: e instanceof Error ? e : new Error(String(e)),
        });
      }
    }

    for (const cb of afterLoadItemsCallbacks) {
      if (cb) {
        try {
          await cb();
        } catch (e) {
          console.error('Array node callback failed', e);
          // Callback errors are not specific to an item, so we don't add them to loadErrors
        }
      }
    }
  }

  /**
   * Override this method to provide better error messages for failed items
   */
  protected getItemInfo(item: TSchema): { type: any; id?: string; name: string } {
    return {
      type: 'sceneItem',
      name: 'Unknown item',
    };
  }

  /**
   * Can be called before loading to do some data munging
   * @param context the context
   */
  async beforeLoad(context: TContext): Promise<void> {}
}
