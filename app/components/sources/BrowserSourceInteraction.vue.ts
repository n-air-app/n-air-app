import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { Subscription } from 'rxjs';
import { SourcesService } from 'services/sources';
import Utils from 'services/utils';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'BrowserSourceInteraction',

  components: { ModalLayout, Display },

  data() {
    return {
      currentRegion: { x: 0, y: 0, width: 1, height: 1 } as IRectangle,
      sourceRemovedSub: null as Subscription | null,
    };
  },

  computed: {
    sourceId(): string {
      const windowId = Utils.getCurrentUrlParams().windowId;
      return WindowsService.instance().getWindowOptions(windowId).sourceId as string;
    },

    source() {
      return SourcesService.instance().getSource(this.sourceId);
    },
  },

  mounted(): void {
    (this.$refs.eventDiv as HTMLDivElement).focus();

    // ソースが削除されたら display の500msポーリングを止めるため window を閉じる（#1380）
    this.sourceRemovedSub = SourcesService.instance().sourceRemoved.subscribe((source) => {
      if (source.sourceId === this.sourceId) {
        WindowsService.instance().closeChildWindow();
      }
    });
  },

  unmounted(): void {
    this.sourceRemovedSub?.unsubscribe();
  },

  methods: {
    onOutputResize(region: IRectangle): void {
      this.currentRegion = region;
    },

    eventLocationInSourceSpace(e: MouseEvent): IVec2 {
      const factor = WindowsService.instance().state.child.scaleFactor;
      return {
        x:
          ((e.offsetX * factor - this.currentRegion.x) / this.currentRegion.width)
          * this.source.width,
        y:
          ((e.offsetY * factor - this.currentRegion.y) / this.currentRegion.height)
          * this.source.height,
      };
    },

    onWheel(e: WheelEvent): void {
      // ソース削除直後、windowが閉じるまでの短い間 source が undefined になりうる（#1380）
      if (!this.source) return;
      this.source.mouseWheel(this.eventLocationInSourceSpace(e), {
        x: e.deltaX,
        y: e.deltaY,
      });
    },

    onMousedown(e: MouseEvent): void {
      if (!this.source) return;
      this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), false);
    },

    onMouseup(e: MouseEvent): void {
      if (!this.source) return;
      this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), true);
    },

    onMousemove(e: MouseEvent): void {
      if (!this.source) return;
      const pos = this.eventLocationInSourceSpace(e);
      if (pos.x < 0 || pos.y < 0) return;
      this.source.mouseMove(pos);
    },

    onKeydown(e: KeyboardEvent): void {
      if (!this.source) return;
      if (this.isModifierPress(e)) return;
      this.source.keyInput(e.key, e.keyCode, false, this.getModifiers(e));
    },

    onKeyup(e: KeyboardEvent): void {
      if (!this.source) return;
      if (this.isModifierPress(e)) return;
      this.source.keyInput(e.key, e.keyCode, true, this.getModifiers(e));
    },

    isModifierPress(event: KeyboardEvent): boolean {
      return (
        event.key === 'Control'
        || event.key === 'Alt'
        || event.key === 'Meta'
        || event.key === 'Shift'
      );
    },

    getModifiers(e: KeyboardEvent) {
      return {
        alt: e.altKey,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
      };
    },
  },
});
