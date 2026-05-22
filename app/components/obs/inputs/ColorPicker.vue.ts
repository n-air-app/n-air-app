import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';

interface IColor {
  r: number;
  g: number;
  b: number;
  a: number; // 0.0 - 1.0
}

interface IHsv {
  h: number; // 0 - 360
  s: number; // 0 - 1
  v: number; // 0 - 1
}

function rgbToHsv(r: number, g: number, b: number): IHsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === rn) {
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
      h = ((bn - rn) / d + 2) / 6;
    } else {
      h = ((rn - gn) / d + 4) / 6;
    }
  }

  return { h: h * 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hn = h / 360;
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = 0;
  let g = 0;
  let b = 0;

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

@Component({})
export default class ColorPicker extends Vue {
  /** rgba value: r/g/b in 0-255, a in 0.0-1.0 */
  @Prop({ required: true })
    value: IColor;

  // Internal HSV state (avoids rounding issues when dragging)
  private hsv: IHsv = { h: 0, s: 0, v: 1 };
  private internalAlpha: number = 1;

  // Dragging state
  private draggingSat = false;
  private draggingHue = false;
  private draggingAlpha = false;

  created() {
    this.syncFromValue();
  }

  @Watch('value')
  onValueChanged() {
    // Only sync from outside if we're not currently dragging
    if (!this.draggingSat && !this.draggingHue && !this.draggingAlpha) {
      this.syncFromValue();
    }
  }

  private syncFromValue() {
    const { r, g, b, a } = this.value;
    this.hsv = rgbToHsv(r, g, b);
    this.internalAlpha = a;
  }

  // ─── Computed ────────────────────────────────────────────────────────────

  get rgba(): IColor {
    const { r, g, b } = hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
    return { r, g, b, a: this.internalAlpha };
  }

  get hueBackground(): string {
    return `hsl(${this.hsv.h}, 100%, 50%)`;
  }

  get satPointerTop(): string {
    return `${(1 - this.hsv.v) * 100}%`;
  }

  get satPointerLeft(): string {
    return `${this.hsv.s * 100}%`;
  }

  get huePointerLeft(): string {
    return `${(this.hsv.h / 360) * 100}%`;
  }

  get alphaPointerLeft(): string {
    return `${this.internalAlpha * 100}%`;
  }

  get alphaGradient(): string {
    const { r, g, b } = this.rgba;
    return `linear-gradient(to right, rgba(${r},${g},${b},0), rgb(${r},${g},${b}))`;
  }

  get previewColor(): string {
    const { r, g, b, a } = this.rgba;
    return `rgba(${r},${g},${b},${a})`;
  }

  get hexInput(): string {
    const { r, g, b } = this.rgba;
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  get alphaPercent(): number {
    return Math.round(this.internalAlpha * 100);
  }

  // ─── Saturation/Brightness drag ──────────────────────────────────────────

  onSaturationMouseDown(e: MouseEvent) {
    this.draggingSat = true;
    this.updateSaturation(e);
    window.addEventListener('mousemove', this.onSaturationMouseMove);
    window.addEventListener('mouseup', this.onSaturationMouseUp);
  }

  private onSaturationMouseMove = (e: MouseEvent) => {
    this.updateSaturation(e);
  };

  private onSaturationMouseUp = () => {
    this.draggingSat = false;
    window.removeEventListener('mousemove', this.onSaturationMouseMove);
    window.removeEventListener('mouseup', this.onSaturationMouseUp);
    this.emitColor();
  };

  private updateSaturation(e: MouseEvent) {
    const el = this.$refs.saturation as HTMLElement;
    const rect = el.getBoundingClientRect();
    const s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    this.hsv = { ...this.hsv, s, v };
    this.emitColor();
  }

  // ─── Hue drag ────────────────────────────────────────────────────────────

  onHueMouseDown(e: MouseEvent) {
    this.draggingHue = true;
    this.updateHue(e);
    window.addEventListener('mousemove', this.onHueMouseMove);
    window.addEventListener('mouseup', this.onHueMouseUp);
  }

  private onHueMouseMove = (e: MouseEvent) => {
    this.updateHue(e);
  };

  private onHueMouseUp = () => {
    this.draggingHue = false;
    window.removeEventListener('mousemove', this.onHueMouseMove);
    window.removeEventListener('mouseup', this.onHueMouseUp);
    this.emitColor();
  };

  private updateHue(e: MouseEvent) {
    const el = this.$refs.hue as HTMLElement;
    const rect = el.getBoundingClientRect();
    const h = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360;
    this.hsv = { ...this.hsv, h };
    this.emitColor();
  }

  // ─── Alpha drag ──────────────────────────────────────────────────────────

  onAlphaMouseDown(e: MouseEvent) {
    this.draggingAlpha = true;
    this.updateAlpha(e);
    window.addEventListener('mousemove', this.onAlphaMouseMove);
    window.addEventListener('mouseup', this.onAlphaMouseUp);
  }

  private onAlphaMouseMove = (e: MouseEvent) => {
    this.updateAlpha(e);
  };

  private onAlphaMouseUp = () => {
    this.draggingAlpha = false;
    window.removeEventListener('mousemove', this.onAlphaMouseMove);
    window.removeEventListener('mouseup', this.onAlphaMouseUp);
    this.emitColor();
  };

  private updateAlpha(e: MouseEvent) {
    const el = this.$refs.alpha as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.internalAlpha = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    this.emitColor();
  }

  // ─── Input field handlers ────────────────────────────────────────────────

  onHexChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const hex = input.value.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      // Reset to current value
      input.value = this.hexInput;
      return;
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    this.hsv = rgbToHsv(r, g, b);
    this.emitColor();
  }

  onRgbChange(channel: 'r' | 'g' | 'b', e: Event) {
    const input = e.target as HTMLInputElement;
    const val = clamp(parseInt(input.value, 10) || 0, 0, 255);
    const current = this.rgba;
    const updated = { ...current, [channel]: val };
    this.hsv = rgbToHsv(updated.r, updated.g, updated.b);
    this.emitColor();
  }

  onAlphaChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const val = clamp(parseInt(input.value, 10) || 0, 0, 100);
    this.internalAlpha = val / 100;
    this.emitColor();
  }

  // ─── Emit ────────────────────────────────────────────────────────────────

  private emitColor() {
    this.$emit('input', { ...this.rgba });
  }

  beforeDestroy() {
    window.removeEventListener('mousemove', this.onSaturationMouseMove);
    window.removeEventListener('mouseup', this.onSaturationMouseUp);
    window.removeEventListener('mousemove', this.onHueMouseMove);
    window.removeEventListener('mouseup', this.onHueMouseUp);
    window.removeEventListener('mousemove', this.onAlphaMouseMove);
    window.removeEventListener('mouseup', this.onAlphaMouseUp);
  }
}
