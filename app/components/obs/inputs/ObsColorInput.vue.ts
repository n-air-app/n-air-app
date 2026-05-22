import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import Utils from 'services/utils';
import { Component, Prop } from 'vue-property-decorator';

import ColorPicker from './ColorPicker.vue';
import { IObsInput, ObsInput, TObsType } from './ObsInput';

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

@Component({
  components: { ColorPicker },
})
class ObsColorInput extends ObsInput<IObsInput<number>> {
  static obsType: TObsType;

  @Prop()
    value: IObsInput<number>;
  testingAnchor = `Form/Color/${this.value.name}`;

  pickerVisible = false;

  togglePicker() {
    this.pickerVisible = !this.pickerVisible;
  }

  closePicker() {
    this.pickerVisible = false;
  }

  isDragging = false;

  handleDraggingChange(dragging: boolean) {
    this.isDragging = dragging;
  }

  handleColorChange(color: IColor) {
    if (this.isDragging) {
      this.setValueImpl(color);
    } else {
      this.setValue(color);
    }
  }

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
  }

  private hexToRGB(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace(/^#/, '');
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };

    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  }

  private setValueImpl(rgba: IColor) {
    if (!isEqual(rgba, this.obsColor)) {
      const intColor = Utils.rgbaToInt(rgba.r, rgba.g, rgba.b, Math.round(255 * rgba.a));
      this.emitInput({ ...this.value, value: intColor });
    }
  }

  private debouncedSetValue = debounce(this.setValueImpl, 500);

  setValue(rgba: IColor) {
    this.debouncedSetValue(rgba);
  }

  mounted() {
    this.setValue(this.obsColor);
  }

  beforeDestroy() {
    this.debouncedSetValue.cancel();
  }

  get hexAlpha() {
    const alpha = this.obsColor.a;
    return Math.floor(alpha * 255).toString(16).padStart(2, '0');
  }

  get hexColor() {
    const rgba = Utils.intToRgba(this.value.value);
    return this.intTo2hexDigit(rgba.r) + this.intTo2hexDigit(rgba.g) + this.intTo2hexDigit(rgba.b);
  }

  // This is displayed to the user
  get hexARGB() {
    return ('#' + this.hexAlpha + this.hexColor).toLowerCase();
  }

  get swatchStyle() {
    return {
      backgroundColor: '#' + this.hexColor,
      opacity: this.obsColor.a || 1,
    };
  }

  get obsColor(): IColor {
    const rgba = Utils.intToRgba(this.value.value);
    return {
      r: rgba.r,
      g: rgba.g,
      b: rgba.b,
      a: Number((rgba.a / 255).toFixed(2)),
    };
  }

  private intTo2hexDigit(int: number) {
    let result = int.toString(16);
    if (result.length === 1) result = '0' + result;
    return result;
  }
}

ObsColorInput.obsType = 'OBS_PROPERTY_COLOR';

export default ObsColorInput;
