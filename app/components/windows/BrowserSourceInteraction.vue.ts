import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { Inject } from 'services/core/injector';
import { SourcesService } from 'services/sources';
import Utils from 'services/utils';
import { WindowsService } from 'services/windows';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: { ModalLayout, Display },
})
export default class BrowserSourceInteraction extends Vue {
  @Inject() windowsService: WindowsService;
  @Inject() sourcesService: SourcesService;

  $refs: {
    eventDiv: HTMLDivElement;
  };

  get sourceId() {
    const windowId = Utils.getCurrentUrlParams().windowId;
    return this.windowsService.getWindowOptions(windowId).sourceId;
  }

  get source() {
    return this.sourcesService.getSource(this.sourceId);
  }

  currentRegion: IRectangle = { x: 0, y: 0, width: 1, height: 1 };

  onOutputResize(region: IRectangle) {
    this.currentRegion = region;
  }

  eventLocationInSourceSpace(e: MouseEvent): IVec2 {
    const factor = this.windowsService.state.child.scaleFactor;
    return {
      x:
        ((e.offsetX * factor - this.currentRegion.x) / this.currentRegion.width) *
        this.source.width,
      y:
        ((e.offsetY * factor - this.currentRegion.y) / this.currentRegion.height) *
        this.source.height,
    };
  }

  onWheel(e: WheelEvent) {
    this.source.mouseWheel(this.eventLocationInSourceSpace(e), {
      x: e.deltaX,
      y: e.deltaY,
    });
  }

  onMousedown(e: MouseEvent) {
    this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), false);
  }

  onMouseup(e: MouseEvent) {
    this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), true);
  }

  onMousemove(e: MouseEvent) {
    const pos = this.eventLocationInSourceSpace(e);
    if (pos.x < 0 || pos.y < 0) return;
    this.source.mouseMove(pos);
  }

  onKeydown(e: KeyboardEvent) {
    if (this.isModifierPress(e)) return;

    this.source.keyInput(e.key, e.keyCode, false, this.getModifiers(e));
  }

  onKeyup(e: KeyboardEvent) {
    if (this.isModifierPress(e)) return;

    this.source.keyInput(e.key, e.keyCode, true, this.getModifiers(e));
  }

  isModifierPress(event: KeyboardEvent) {
    return (
      event.key === 'Control' ||
      event.key === 'Alt' ||
      event.key === 'Meta' ||
      event.key === 'Shift'
    );
  }

  getModifiers(e: KeyboardEvent) {
    return {
      alt: e.altKey,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
    };
  }

  mounted() {
    // Allows keyboard events to be immediately captured
    this.$refs.eventDiv.focus();
  }
}
