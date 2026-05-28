import { MonitorCaptureCroppingService } from 'services/sources/monitor-capture-cropping';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CroppingOverlay',

  props: {
    sourceId: { type: String },
  },

  data() {
    return {
      isCropping: false,
      anchorPositionX: 0,
      anchorPositionY: 0,
      movingPositionX: 0,
      movingPositionY: 0,
    };
  },

  computed: {
    croppingArea() {
      return {
        top: Math.min(this.movingPositionY, this.anchorPositionY),
        left: Math.min(this.movingPositionX, this.anchorPositionX),
        width: Math.abs(this.movingPositionX - this.anchorPositionX),
        height: Math.abs(this.movingPositionY - this.anchorPositionY),
      };
    },

    croppingAreaStyle() {
      const croppingArea = this.croppingArea;
      return {
        top: croppingArea.top + 'px',
        left: croppingArea.left + 'px',
        width: croppingArea.width + 'px',
        height: croppingArea.height + 'px',
      };
    },
  },

  mounted() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });

    window.addEventListener('blur', (e) => {
      window.close();
    });
    window.focus();
  },

  methods: {
    handleMouseDown(event: MouseEvent) {
      if (event.button !== 0) return;
      this.isCropping = true;

      const x = event.pageX;
      const y = event.pageY;

      this.anchorPositionX = x;
      this.anchorPositionY = y;
      this.movingPositionX = x;
      this.movingPositionY = y;
    },

    handleMouseMove(event: MouseEvent) {
      if (event.button !== 0) return;
      if (!this.isCropping) return;

      const x = event.pageX;
      const y = event.pageY;

      this.movingPositionX = x;
      this.movingPositionY = y;
    },

    handleMouseUp(event: MouseEvent) {
      if (event.button !== 0) return;
      if (!this.isCropping) return;

      MonitorCaptureCroppingService.instance.crop(this.croppingArea);

      this.isCropping = false;
      window.close();
    },
  },
});
