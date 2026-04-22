import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import draggable from 'vuedraggable';
import * as Sentry from '@sentry/vue';

interface ISelectorItem {
  name: string;
  value: string;
}

@Component({
  components: { draggable },
})
export default class Selector extends Vue {
  @Prop()
  items: ISelectorItem[];

  @Prop()
  activeItems: string[];

  @Prop({ default: true, type: Boolean })
  draggable: boolean;

  // @ts-expect-error: ts2729: use before initialization
  draggableSelector: string = this.draggable ? '.selector-item' : 'none';

  beforeDestroy() {
    // sortablejs 1.10.2 (および最新 1.15.7 でも未修正) のバグ回避:
    // destroy() が this._onDrop() を引数なしで呼ぶため、dragEl からの dragend リスナー解除
    // コード (if (evt) ブロック内) に到達しない。その後 this.el = null が設定されるが、
    // ブラウザの dragend イベントが非同期で発火し handleEvent → _onDrop(evt) が呼ばれ、
    // this.el が null のため TypeError: Cannot read properties of null (reading 'removeEventListener')
    // が発生する。(Sentry: N-AIR-APP-F3Z, GitHub: #1230)
    //
    // Vue 2 では親の beforeDestroy が子より先に実行されるため、ここで sortable の
    // handleEvent をラップすることで、vuedraggable の beforeDestroy → sortable.destroy()
    // の後に来る dragend イベントを安全に処理できる。
    //
    // Vue 3 移行時: beforeDestroy → beforeUnmount にリネーム、実行順序は同じなのでロジック流用可能。
    // sortablejs 上流でこのバグが修正されたらこの workaround は除去可能。
    // sortablejs の型定義がないため、使用する内部プロパティの最小限の型を定義する
    interface SortableInstance {
      el: HTMLElement | null;
      handleEvent(evt: Event): void;
      _nulling?(): void;
    }
    try {
      const draggableRef = this.$refs.draggable;
      if (!(draggableRef instanceof Vue)) return;
      const draggableVm = draggableRef as Vue & { _sortable?: SortableInstance };
      const sortable = draggableVm._sortable;
      if (sortable) {
        const origHandleEvent = sortable.handleEvent.bind(sortable);
        sortable.handleEvent = function (this: SortableInstance, evt: Event) {
          if (!this.el) {
            // destroy() 済み: ドラッグ結果は既に反映済みなので、グローバル変数のリセットのみ行う
            this._nulling?.();
            Sentry.withScope(scope => {
              scope.setLevel('warning');
              scope.setTag('issue', 'N-AIR-APP-F3Z');
              Sentry.captureMessage(`sortablejs: ${evt.type} event after destroy() suppressed`);
            });
            return;
          }
          origHandleEvent(evt);
        };
      }
    } catch {
      // best-effort: コンポーネント破棄をブロックしない
    }
  }

  handleChange(change: any) {
    const order = this.normalizedItems.map(item => {
      return item.value;
    });

    this.$emit('sort', {
      change,
      order,
    });
  }

  handleSelect(ev: MouseEvent, index: number) {
    const value = this.normalizedItems[index].value;
    this.$emit('select', value, ev);
  }

  handleContextMenu(ev: MouseEvent, index?: number) {
    if (index !== undefined) {
      const value = this.normalizedItems[index].value;
      this.handleSelect(ev, index);
      this.$emit('contextmenu', value);
      return;
    }
    this.$emit('contextmenu');
  }

  handleDoubleClick(ev: MouseEvent, index: number) {
    const value = this.normalizedItems[index].value;
    this.handleSelect(ev, index);
    this.$emit('dblclick', value);
  }

  /**
   * Items can be either an array of strings, or an
   * array of objects, so we normalize those here.
   */
  get normalizedItems(): ISelectorItem[] {
    return this.items.map(item => {
      if (typeof item === 'string') {
        return {
          name: item,
          value: item,
        };
      } else {
        return item;
      }
    });
  }
}
