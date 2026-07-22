import { uuidv4 } from 'services/utils';
import { Display as OBSDisplay } from 'services/video';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Display',

  props: {
    sourceId: { type: String },
    paddingSize: { type: Number, default: 0 },
    drawUI: { type: Boolean, default: false },
    renderingMode: { type: Number },
  },

  data() {
    return {
      display: null as OBSDisplay | null,
    };
  },

  watch: {
    sourceId() {
      this.updateDisplay();
    },
  },

  mounted() {
    this.createDisplay();
  },

  beforeUnmount() {
    this.destroyDisplay();
  },

  methods: {
    onClickHandler(event: MouseEvent) {
      this.$emit('click', event);
    },

    createDisplay() {
      const displayId = uuidv4();
      this.display = new OBSDisplay(displayId, {
        sourceId: this.sourceId,
        paddingSize: this.paddingSize,
        renderingMode: this.renderingMode,
      });
      this.display.setShoulddrawUI(this.drawUI);

      this.display.onOutputResize((region: IRectangle) => {
        this.$emit('outputResize', region);
      });

      this.display.trackElement(this.$refs.display as HTMLElement);
    },

    destroyDisplay() {
      this.display?.destroy();
    },

    updateDisplay() {
      this.destroyDisplay();
      this.createDisplay();
    },
  },
});
