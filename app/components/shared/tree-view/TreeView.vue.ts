import { CSSProperties, defineComponent, PropType } from 'vue';

import { buildTreeNodes, flattenTree, getDropPlacement, isSameOrDescendant, resolveDropPosition, selectNodes } from './tree-utils';
import { ITreeCursorPosition, ITreeNode, ITreeNodeModel, TDropPlacement } from './types';

export default defineComponent({
  name: 'TreeView',
  props: {
    value: { type: Array as PropType<ITreeNodeModel<unknown>[]>, default: (): ITreeNodeModel<unknown>[] => [] },
    allowMultiselect: { type: Boolean, default: true },
    edgeSize: { type: Number, default: 3 },
    scrollAreaHeight: { type: Number, default: 70 },
    maxScrollSpeed: { type: Number, default: 20 },
  },
  emits: ['select', 'drop', 'toggle', 'nodeclick', 'nodedblclick', 'nodecontextmenu', 'contextmenu'],
  data: () => ({
    cursorPosition: null as ITreeCursorPosition<unknown> | null,
    draggingNodes: [] as ITreeNode<unknown>[],
    lastSelectedPath: null as string | null,
    scrollFrame: 0,
    scrollSpeed: 0,
    dragStarted: false,
  }),
  computed: {
    nodes(): ITreeNode<unknown>[] { return buildTreeNodes(this.value); },
    allNodes(): ITreeNode<unknown>[] { return flattenTree(this.nodes); },
    visibleNodes(): ITreeNode<unknown>[] { return flattenTree(this.nodes, true); },
  },
  beforeUnmount() { this.stopScroll(); },
  methods: {
    nodeClasses(node: ITreeNode<unknown>) {
      const cursor = this.cursorPosition?.node.pathStr === node.pathStr;
      return {
        'tree-view-cursor-hover': cursor,
        'tree-view-cursor-inside': cursor && this.cursorPosition?.placement === 'inside',
        'tree-view-dragging': this.draggingNodes.some((candidate: ITreeNode<unknown>) => candidate.pathStr === node.pathStr),
        'tree-view-node-is-leaf': node.isLeaf,
        'tree-view-node-is-folder': !node.isLeaf,
      };
    },
    cursorStyle(node: ITreeNode<unknown>, placement: TDropPlacement): CSSProperties {
      const lineNode = this.cursorPosition?.lineNode || this.cursorPosition?.node;
      const linePlacement = this.cursorPosition?.linePlacement || this.cursorPosition?.placement;
      const visible = lineNode?.pathStr === node.pathStr && linePlacement === placement;
      const level = this.cursorPosition?.lineLevel || node.level;
      return { visibility: visible ? 'visible' : 'hidden', '--depth': level - 1 } as CSSProperties;
    },
    emitSelection(node: ITreeNode<unknown>, event: MouseEvent, additive: boolean, anchor?: string) {
      this.lastSelectedPath = node.pathStr;
      this.$emit('select', selectNodes(this.allNodes, node, { additive, rangeAnchorPath: anchor }), event);
    },
    onNodeMouseDown(node: ITreeNode<unknown>, event: MouseEvent) {
      if (event.button !== 0) return;
      const additive = this.allowMultiselect && (event.ctrlKey || event.metaKey);
      const anchor = this.allowMultiselect && event.shiftKey ? this.lastSelectedPath || undefined : undefined;
      // 複数項目をまとめてドラッグできるよう、既存の複数選択は mouseup まで維持する。
      if (!node.isSelected || additive || anchor) this.emitSelection(node, event, additive, anchor);
    },
    onNodeMouseUp(node: ITreeNode<unknown>, event: MouseEvent) {
      if (event.button === 0 && !this.dragStarted && node.isSelected && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        this.emitSelection(node, event, false);
      }
    },
    toggle(node: ITreeNode<unknown>, event: MouseEvent) { this.$emit('toggle', node, event); },
    onDragStart(node: ITreeNode<unknown>, event: DragEvent) {
      if (!node.isDraggable) { event.preventDefault(); return; }
      this.dragStarted = true;
      this.draggingNodes = node.isSelected
        ? this.allNodes.filter((candidate: ITreeNode<unknown>) => candidate.isSelected && candidate.isDraggable)
        : [node];
      event.dataTransfer?.setData('text/plain', node.pathStr);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    },
    onNodeDragOver(node: ITreeNode<unknown>, event: DragEvent) {
      if (!this.draggingNodes.length) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const placement = getDropPlacement(!!node.isLeaf, event.clientY - rect.top, rect.height, this.edgeSize);
      const rootRect = (this.$refs.root as HTMLElement).getBoundingClientRect();
      const desiredLevel = Math.max(1, Math.floor((event.clientX - rootRect.left - 12) / 24) + 1);
      this.cursorPosition = resolveDropPosition(this.allNodes, this.visibleNodes, node, placement, desiredLevel);
      this.updateAutoScroll(event.clientY);
    },
    onRootDragOver(event: DragEvent) {
      if (!this.draggingNodes.length || (event.target as HTMLElement).closest('[data-tree-path]')) return;
      event.preventDefault();
      const rect = (this.$refs.root as HTMLElement).getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      const node = before ? this.visibleNodes[0] : this.visibleNodes[this.visibleNodes.length - 1];
      if (node) {
        const placement = before ? 'before' : 'after';
        this.cursorPosition = resolveDropPosition(this.allNodes, this.visibleNodes, node, placement, 1);
      }
      this.updateAutoScroll(event.clientY);
    },
    onDrop(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      const position = this.cursorPosition;
      const destination = position?.parentNode || position?.node;
      if (position && destination && this.draggingNodes.length
        && !this.draggingNodes.some((node: ITreeNode<unknown>) => isSameOrDescendant(node, destination))) {
        this.$emit('drop', this.draggingNodes, position, event);
      }
      this.stopDrag();
    },
    updateAutoScroll(y: number) {
      const rect = (this.$refs.root as HTMLElement).getBoundingClientRect();
      if (y > rect.bottom - this.scrollAreaHeight) this.startScroll((y - rect.bottom + this.scrollAreaHeight) / this.scrollAreaHeight);
      else if (y < rect.top + this.scrollAreaHeight) this.startScroll(-((rect.top + this.scrollAreaHeight - y) / this.scrollAreaHeight));
      else this.stopScroll();
    },
    startScroll(speed: number) {
      this.scrollSpeed = Math.max(-1, Math.min(1, speed));
      if (this.scrollFrame) return;
      const scroll = () => {
        (this.$refs.root as HTMLElement).scrollTop += this.maxScrollSpeed * this.scrollSpeed;
        this.scrollFrame = requestAnimationFrame(scroll);
      };
      this.scrollFrame = requestAnimationFrame(scroll);
    },
    stopScroll() { cancelAnimationFrame(this.scrollFrame); this.scrollFrame = 0; this.scrollSpeed = 0; },
    stopDrag() {
      this.draggingNodes = [];
      this.cursorPosition = null;
      this.stopScroll();
      // dragend が mouseup より先に発生しても選択が変わらないよう、状態の解除を次フレームまで遅らせる。
      requestAnimationFrame(() => { this.dragStarted = false; });
    },
  },
});
