import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
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
    };
  },

  computed: {
    sourceId(): string {
      const windowId = Utils.getCurrentUrlParams().windowId;
      return WindowsService.instance().getWindowOptions(windowId).sourceId;
    },

    source() {
      return SourcesService.instance().getSource(this.sourceId);
    },
  },

  mounted(): void {
    (this.$refs.eventDiv as HTMLDivElement).focus();
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
      this.source.mouseWheel(this.eventLocationInSourceSpace(e), {
        x: e.deltaX,
        y: e.deltaY,
      });
    },

    onMousedown(e: MouseEvent): void {
      this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), false);
    },

    onMouseup(e: MouseEvent): void {
      this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), true);
    },

    onMousemove(e: MouseEvent): void {
      const pos = this.eventLocationInSourceSpace(e);
      if (pos.x < 0 || pos.y < 0) return;
      this.source.mouseMove(pos);
    },

    onKeydown(e: KeyboardEvent): void {
      if (this.isModifierPress(e)) return;
      this.source.keyInput(e.key, e.keyCode, false, this.getModifiers(e));
    },

    onKeyup(e: KeyboardEvent): void {
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
