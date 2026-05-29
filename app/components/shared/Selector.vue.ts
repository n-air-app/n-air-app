import { defineComponent } from 'vue';

interface ISelectorItem {
  name: string;
  value: string;
}

export default defineComponent({
  name: 'Selector',

  props: {
    items: { type: Array as () => ISelectorItem[] },
    activeItems: { type: Array as () => string[] },
    draggable: { type: Boolean, default: true },
  },

  data() {
    return {
      localItems: [] as ISelectorItem[],
      draggingIndex: null as number | null,
      itemsBeforeDrag: [] as ISelectorItem[],
      dragStartIndex: null as number | null,
    };
  },

  watch: {
    items: {
      deep: true,
      handler(newItems: ISelectorItem[]) {
        if (this.draggingIndex === null) {
          this.localItems = this.normalizeItems(newItems);
        }
      },
    },
  },

  created() {
    this.localItems = this.normalizeItems(this.items as ISelectorItem[]);
  },

  methods: {
    onDragStart(ev: DragEvent, index: number) {
      if (!this.draggable) return;
      this.draggingIndex = index;
      this.dragStartIndex = index;
      this.itemsBeforeDrag = [...this.localItems];
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', String(index));
      }
    },

    onDragOver(ev: DragEvent, index: number) {
      if (!this.draggable || this.draggingIndex === null) return;
      ev.preventDefault();
      if (ev.dataTransfer) { ev.dataTransfer.dropEffect = 'move'; }

      const fromIndex = this.draggingIndex;
      if (fromIndex === index) return;

      const newItems = [...this.localItems];
      const [moved] = newItems.splice(fromIndex, 1);
      newItems.splice(index, 0, moved);
      this.localItems = newItems;
      this.draggingIndex = index;
    },

    commitDrop(appendToEnd: boolean) {
      if (!this.draggable || this.draggingIndex === null) return;

      const fromIndex = this.draggingIndex;
      const itemsBeforeDrag = this.itemsBeforeDrag;
      const dragStartIndex = this.dragStartIndex!;
      this.draggingIndex = null;
      this.dragStartIndex = null;
      this.itemsBeforeDrag = [];

      if (appendToEnd) {
        const lastIndex = this.localItems.length - 1;
        if (fromIndex !== lastIndex) {
          const newItems = [...this.localItems];
          const [moved] = newItems.splice(fromIndex, 1);
          newItems.push(moved);
          this.localItems = newItems;
        }
      }

      const newItems = this.localItems;
      const oldIndex = dragStartIndex;
      const newIndex = newItems.indexOf(itemsBeforeDrag[dragStartIndex]);

      if (oldIndex === newIndex) return;

      const order = newItems.map((item: ISelectorItem) => item.value);
      this.$emit('sort', {
        change: { moved: { element: newItems[newIndex], oldIndex, newIndex } },
        order,
      });
    },

    onDropAtIndex(ev: DragEvent, _index: number | null) {
      ev.preventDefault();
      this.commitDrop(false);
    },

    onDropAtEnd(ev: DragEvent) {
      ev.preventDefault();
      this.commitDrop(true);
    },

    onDragEnd() {
      if (this.draggingIndex !== null) {
        this.localItems = this.itemsBeforeDrag;
      }
      this.draggingIndex = null;
      this.dragStartIndex = null;
      this.itemsBeforeDrag = [];
    },

    handleSelect(ev: MouseEvent, index: number) {
      const value = this.localItems[index].value;
      this.$emit('select', value, ev);
    },

    handleContextMenu(ev: MouseEvent, index?: number) {
      if (index !== undefined) {
        const value = this.localItems[index].value;
        this.handleSelect(ev, index);
        this.$emit('contextmenu', value);
        return;
      }
      this.$emit('contextmenu');
    },

    handleDoubleClick(ev: MouseEvent, index: number) {
      const value = this.localItems[index].value;
      this.handleSelect(ev, index);
      this.$emit('dblclick', value);
    },

    normalizeItems(items: ISelectorItem[]): ISelectorItem[] {
      return (items || []).map((item) => {
        if (typeof item === 'string') {
          return { name: item, value: item };
        }
        return item;
      });
    },
  },
});

