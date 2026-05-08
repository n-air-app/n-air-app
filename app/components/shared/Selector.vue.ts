import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';

interface ISelectorItem {
  name: string;
  value: string;
}

@Component({})
export default class Selector extends Vue {
  @Prop()
  items: ISelectorItem[];

  @Prop()
  activeItems: string[];

  @Prop({ default: true, type: Boolean })
  draggable: boolean;

  /**
   * 表示用のローカルコピー。ドラッグ中にリアルタイムで並び替えを反映するために使用。
   * props の items が変化したときは watch で同期する。
   * テンプレートから参照するため public だが、外部から直接変更しないこと。
   */
  localItems: ISelectorItem[] = [];

  created() {
    this.localItems = this.normalizeItems(this.items);
  }

  @Watch('items', { deep: true })
  onItemsChanged(newItems: ISelectorItem[]) {
    // ドラッグ中でなければ props の変化を反映する
    if (this.draggingIndex === null) {
      this.localItems = this.normalizeItems(newItems);
    }
  }

  /**
   * ドラッグ中のアイテムの現在のインデックス。
   * value ではなくインデックスで追跡することで、同一 value を持つ重複アイテムがあっても
   * 正しいアイテムを操作できる。
   */
  draggingIndex: number | null = null;

  /** ドラッグ開始時点の元の順序（キャンセル時の復元用） */
  private itemsBeforeDrag: ISelectorItem[] = [];

  /** ドラッグ開始時の元インデックス（emit する oldIndex 用） */
  private dragStartIndex: number | null = null;

  onDragStart(ev: DragEvent, index: number) {
    if (!this.draggable) return;
    this.draggingIndex = index;
    this.dragStartIndex = index;
    this.itemsBeforeDrag = [...this.localItems];
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', String(index));
    }
  }

  onDragOver(ev: DragEvent, index: number) {
    if (!this.draggable || this.draggingIndex === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';

    const fromIndex = this.draggingIndex;
    if (fromIndex === index) return;

    // ドラッグ中にリアルタイムで並び替えを反映する
    const newItems = [...this.localItems];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(index, 0, moved);
    this.localItems = newItems;
    this.draggingIndex = index;
  }

  private commitDrop(appendToEnd: boolean) {
    if (!this.draggable || this.draggingIndex === null) return;

    const fromIndex = this.draggingIndex;
    const itemsBeforeDrag = this.itemsBeforeDrag;
    const dragStartIndex = this.dragStartIndex!;
    this.draggingIndex = null;
    this.dragStartIndex = null;
    this.itemsBeforeDrag = [];

    // 末尾ドロップ時は onDragOver が呼ばれていないため、ここで並び替えを実行する
    if (appendToEnd) {
      const lastIndex = this.localItems.length - 1;
      if (fromIndex !== lastIndex) {
        const newItems = [...this.localItems];
        const [moved] = newItems.splice(fromIndex, 1);
        newItems.push(moved);
        this.localItems = newItems;
      }
    }

    // onDragOver（または上記の末尾移動）で localItems は最終状態になっている
    const newItems = this.localItems;
    const oldIndex = dragStartIndex;
    const newIndex = newItems.indexOf(itemsBeforeDrag[dragStartIndex]);

    if (oldIndex === newIndex) return;

    const order = newItems.map(item => item.value);
    this.$emit('sort', {
      change: { moved: { element: newItems[newIndex], oldIndex, newIndex } },
      order,
    });
  }

  onDropAtIndex(ev: DragEvent, _index: number | null) {
    ev.preventDefault();
    this.commitDrop(false);
  }

  onDropAtEnd(ev: DragEvent) {
    ev.preventDefault();
    this.commitDrop(true);
  }

  onDragEnd() {
    // drop → dragend の順で両方発火するため、onDrop 済みの場合は draggingIndex が null になっている。
    // draggingIndex が残っている場合はドロップなしキャンセルなので元の順序に戻す。
    if (this.draggingIndex !== null) {
      this.localItems = this.itemsBeforeDrag;
    }
    this.draggingIndex = null;
    this.dragStartIndex = null;
    this.itemsBeforeDrag = [];
  }

  handleSelect(ev: MouseEvent, index: number) {
    const value = this.localItems[index].value;
    this.$emit('select', value, ev);
  }

  handleContextMenu(ev: MouseEvent, index?: number) {
    if (index !== undefined) {
      const value = this.localItems[index].value;
      this.handleSelect(ev, index);
      this.$emit('contextmenu', value);
      return;
    }
    this.$emit('contextmenu');
  }

  handleDoubleClick(ev: MouseEvent, index: number) {
    const value = this.localItems[index].value;
    this.handleSelect(ev, index);
    this.$emit('dblclick', value);
  }

  /**
   * Items can be either an array of strings, or an
   * array of objects, so we normalize those here.
   */
  private normalizeItems(items: ISelectorItem[]): ISelectorItem[] {
    return (items || []).map(item => {
      if (typeof item === 'string') {
        return { name: item, value: item };
      }
      return item;
    });
  }
}
