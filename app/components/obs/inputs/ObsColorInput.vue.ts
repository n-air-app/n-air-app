import isEqual from 'lodash/isEqual';
import Utils from 'services/utils';
import { defineComponent, PropType } from 'vue';

import ColorPicker from './ColorPicker.vue';
import { IObsInput, TObsType } from './ObsInput';

interface IColorPickerOptions {
  onMouseMoveEnabled?: boolean;
  showPreview?: boolean;
  showText?: boolean;
  previewSize?: number;
}

interface IColorPickerData {
  event: 'mouseClick' | 'mouseMove';
  hex: string;
}

interface IColorPicker {
  startColorPicker(
    callback: (data: IColorPickerData) => void,
    cancelCallback: () => void,
    options?: IColorPickerOptions
  ): void;
}

let colorPicker: IColorPicker | undefined;
try {
  colorPicker = require('color-picker');
} catch (e) {
  // color-picker not available
}

interface IColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const ObsColorInput = defineComponent({
  name: 'ObsColorInput',
  emits: ['input'],
  components: { ColorPicker },
  props: {
    value: { type: Object as PropType<IObsInput<number>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Color/${this.value.name}`,
      pickerVisible: false,
      isDragging: false,
    };
  },
  computed: {
    obsColor(): IColor {
      const rgba = Utils.intToRgba(this.value.value ?? 0);
      return {
        r: rgba.r,
        g: rgba.g,
        b: rgba.b,
        a: Number((rgba.a / 255).toFixed(2)),
      };
    },
    hexAlpha(): string {
      const alpha = this.obsColor.a;
      return Math.floor(alpha * 255).toString(16).padStart(2, '0');
    },
    hexColor(): string {
      const rgba = Utils.intToRgba(this.value.value ?? 0);
      return this.intTo2hexDigit(rgba.r) + this.intTo2hexDigit(rgba.g) + this.intTo2hexDigit(rgba.b);
    },
    hexARGB(): string {
      return ('#' + this.hexAlpha + this.hexColor).toLowerCase();
    },
    swatchStyle(): { backgroundColor: string; opacity: number } {
      return {
        backgroundColor: '#' + this.hexColor,
        opacity: this.obsColor.a || 1,
      };
    },
  },
  mounted() {
    this.setValue(this.obsColor);
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.onDocumentMouseDown);
  },
  methods: {
    emitInput(eventData: IObsInput<number>) {
      this.$emit('input', eventData);
    },
    togglePicker() {
      this.pickerVisible = !this.pickerVisible;
      if (this.pickerVisible) {
        this.$nextTick(() => {
          document.addEventListener('mousedown', this.onDocumentMouseDown);
        });
      } else {
        document.removeEventListener('mousedown', this.onDocumentMouseDown);
      }
    },
    closePicker() {
      this.pickerVisible = false;
      document.removeEventListener('mousedown', this.onDocumentMouseDown);
    },
    onDocumentMouseDown(event: MouseEvent) {
      const menu = this.$refs.colorPickerMenu as InstanceType<typeof ColorPicker> | undefined;
      if (menu && menu.$el && (menu.$el as HTMLElement).contains(event.target as Node)) {
        return;
      }
      const el = this.$el as HTMLElement;
      if (el && el.contains(event.target as Node)) {
        return;
      }
      this.closePicker();
    },
    handleDraggingChange(dragging: boolean) {
      this.isDragging = dragging;
    },
    handleColorChange(color: IColor) {
      this.setValueImpl(color);
    },
    startEyedropper() {
      if (!colorPicker) return;
      colorPicker.startColorPicker(
        (data) => {
          if (data.event === 'mouseClick') {
            const rgb = this.hexToRGB(`#${data.hex}`);
            this.setValue({ ...rgb, a: 1 });
            this.pickerVisible = false;
          }
        },
        () => {
          // Cancel callback
        },
        {
          onMouseMoveEnabled: true,
          showPreview: true,
          showText: false,
          previewSize: 35,
        },
      );
    },
    hexToRGB(hex: string): { r: number; g: number; b: number } {
      const h = hex.replace(/^#/, '');
      if (h.length !== 6) return { r: 0, g: 0, b: 0 };
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
      };
    },
    setValueImpl(rgba: IColor) {
      if (!isEqual(rgba, this.obsColor)) {
        const intColor = Utils.rgbaToInt(rgba.r, rgba.g, rgba.b, Math.round(255 * rgba.a));
        this.emitInput({ ...this.value, value: intColor });
      }
    },
    setValue(rgba: IColor) {
      this.setValueImpl(rgba);
    },
    intTo2hexDigit(int: number): string {
      let result = int.toString(16);
      if (result.length === 1) result = '0' + result;
      return result;
    },
  },
});
export default Object.assign(ObsColorInput, { obsType: 'OBS_PROPERTY_COLOR' as TObsType });
