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
   * 表示用のローカルコピー。ドラッグ中に即座に並び替えを反映するために使用。
   * props の items が変化したときは watch で同期する。
   */
  localItems: ISelectorItem[] = [];

  created() {
    this.localItems = this.normalizeItems(this.items);
  }

  @Watch('items', { deep: true })
  onItemsChanged(newItems: ISelectorItem[]) {
    // ドラッグ中でなければ props の変化を反映する
    if (this.dragFromIndex === null) {
      this.localItems = this.normalizeItems(newItems);
    }
  }

  /** ドラッグ中のアイテムのインデックス */
  private dragFromIndex: number | null = null;

  /** ドロップ先のアイテムのインデックス（ハイライト用） */
  dragOverIndex: number | null = null;

  /** ドラッグ中かどうか（chosen クラス用） */
  draggingIndex: number | null = null;

  onDragStart(ev: DragEvent, index: number) {
    if (!this.draggable) return;
    this.dragFromIndex = index;
    this.draggingIndex = index;
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', String(index));
    }
  }

  onDragOver(ev: DragEvent, index: number) {
    if (!this.draggable || this.dragFromIndex === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.dragOverIndex = index;
  }

  onDragLeave(index: number) {
    if (this.dragOverIndex === index) {
      this.dragOverIndex = null;
    }
  }

  onDrop(ev: DragEvent, toIndex: number) {
    ev.preventDefault();
    if (!this.draggable || this.dragFromIndex === null) return;
    const fromIndex = this.dragFromIndex;
    this.dragFromIndex = null;
    this.dragOverIndex = null;
    this.draggingIndex = null;

    if (fromIndex === toIndex) return;

    // localItems を直接並び替えて即座に表示を更新する
    const newItems = [...this.localItems];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    this.localItems = newItems;

    const order = newItems.map(item => item.value);
    this.$emit('sort', {
      change: { moved: { element: moved, oldIndex: fromIndex, newIndex: toIndex } },
      order,
    });
  }

  onDragEnd() {
    this.dragFromIndex = null;
    this.dragOverIndex = null;
    this.draggingIndex = null;
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
