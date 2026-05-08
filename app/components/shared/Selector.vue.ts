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
    if (this.draggingValue === null) {
      this.localItems = this.normalizeItems(newItems);
    }
  }

  /** ドラッグ中のアイテムの value（localItems が動くためインデックスではなく value で追跡） */
  private draggingValue: string | null = null;

  /** ドラッグ開始時点の元の順序（キャンセル時の復元用） */
  private itemsBeforeDrag: ISelectorItem[] = [];

  /** ドラッグ中かどうか（chosen クラス用） */
  get draggingIndex(): number | null {
    if (this.draggingValue === null) return null;
    const idx = this.localItems.findIndex(i => i.value === this.draggingValue);
    return idx === -1 ? null : idx;
  }

  onDragStart(ev: DragEvent, index: number) {
    if (!this.draggable) return;
    this.draggingValue = this.localItems[index].value;
    this.itemsBeforeDrag = [...this.localItems];
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', this.draggingValue);
    }
  }

  onDragOver(ev: DragEvent, index: number) {
    if (!this.draggable || this.draggingValue === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';

    const fromIndex = this.localItems.findIndex(i => i.value === this.draggingValue);
    if (fromIndex === -1 || fromIndex === index) return;

    // ドラッグ中にリアルタイムで並び替えを反映する
    const newItems = [...this.localItems];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(index, 0, moved);
    this.localItems = newItems;
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    if (!this.draggable || this.draggingValue === null) return;

    const draggedValue = this.draggingValue;
    const itemsBeforeDrag = this.itemsBeforeDrag;
    this.draggingValue = null;
    this.itemsBeforeDrag = [];

    // onDragOver で既に localItems は最終状態になっている
    const newItems = this.localItems;
    const oldIndex = itemsBeforeDrag.findIndex(i => i.value === draggedValue);
    const newIndex = newItems.findIndex(i => i.value === draggedValue);

    if (oldIndex === newIndex) return;

    const order = newItems.map(item => item.value);
    this.$emit('sort', {
      change: { moved: { element: newItems[newIndex], oldIndex, newIndex } },
      order,
    });
  }

  onDragEnd() {
    // drop → dragend の順で両方発火するため、onDrop 済みの場合は draggingValue が null になっている。
    // draggingValue が残っている場合はドロップなしキャンセルなので元の順序に戻す。
    if (this.draggingValue !== null) {
      this.localItems = this.itemsBeforeDrag;
    }
    this.draggingValue = null;
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
