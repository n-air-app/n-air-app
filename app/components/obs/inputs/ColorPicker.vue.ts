import { defineComponent } from 'vue';

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

// r/g/b: 0-255 → h: 0-360, s/v: 0-1
function rgbToHsv(r: number, g: number, b: number): IHsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s, v: max };
}

// h: 0-360, s/v: 0-1 → r/g/b: 0-255
function hsvToRgb(h: number, s: number, v: number) {
  const i = Math.floor(h / 60) % 6;
  const f = (h / 60) - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r: number;
  let g: number;
  let b: number;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

interface IDragContext {
  dragging: boolean;
  $emit(event: string, ...args: unknown[]): void;
}

function startDrag(ctx: IDragContext, e: MouseEvent, onMove: (e: MouseEvent) => void) {
  ctx.dragging = true;
  ctx.$emit('dragging-change', true);
  onMove(e);
  const onMouseUp = () => {
    ctx.dragging = false;
    ctx.$emit('dragging-change', false);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onMouseUp);
}

export default defineComponent({
  name: 'ColorPicker',

  props: {
    value: { type: Object as () => IColor, required: true },
  },

  data() {
    const { r, g, b, a } = this.value as IColor;
    return {
      hsv: rgbToHsv(r, g, b) as IHsv,
      internalAlpha: a as number,
      dragging: false,
    };
  },

  watch: {
    value(val: IColor) {
      if (!this.dragging) {
        this.hsv = rgbToHsv(val.r, val.g, val.b);
        this.internalAlpha = val.a;
      }
    },
  },

  computed: {
    rgbChannels: () => [
      { key: 'r' as const, label: 'R' },
      { key: 'g' as const, label: 'G' },
      { key: 'b' as const, label: 'B' },
    ],
    rgba(): IColor {
      const { r, g, b } = hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
      return { r, g, b, a: this.internalAlpha };
    },
    hueBackground(): string {
      return `hsl(${this.hsv.h}, 100%, 50%)`;
    },
    satPointerTop(): string { return `${(1 - this.hsv.v) * 100}%`; },
    satPointerLeft(): string { return `${this.hsv.s * 100}%`; },
    huePointerLeft(): string { return `${(this.hsv.h / 360) * 100}%`; },
    alphaPointerLeft(): string { return `${this.internalAlpha * 100}%`; },
    alphaGradient(): string {
      const { r, g, b } = this.rgba;
      return `linear-gradient(to right, rgba(${r},${g},${b},0), rgb(${r},${g},${b}))`;
    },
    previewColor(): string {
      const { r, g, b, a } = this.rgba;
      return `rgba(${r},${g},${b},${a})`;
    },
    hexInput(): string {
      const { r, g, b } = this.rgba;
      const rgbHex = [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      const alphaInt = Math.round(this.internalAlpha * 255);
      if (alphaInt === 255) return rgbHex;
      return rgbHex + alphaInt.toString(16).padStart(2, '0');
    },
    alphaInput(): string {
      return Number(this.internalAlpha.toFixed(2)).toString();
    },
  },

  methods: {
    onSaturationMouseDown(e: MouseEvent) {
      startDrag(this, e, (ev: MouseEvent) => {
        const el = this.$refs.saturation as HTMLElement;
        const rect = el.getBoundingClientRect();
        this.hsv = {
          ...this.hsv,
          s: clamp((ev.clientX - rect.left) / rect.width, 0, 1),
          v: clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1),
        };
        this.$emit('input', { ...this.rgba });
      });
    },

    onHueMouseDown(e: MouseEvent) {
      startDrag(this, e, (ev: MouseEvent) => {
        const el = this.$refs.hue as HTMLElement;
        const rect = el.getBoundingClientRect();
        this.hsv = { ...this.hsv, h: clamp((ev.clientX - rect.left) / rect.width, 0, 1) * 360 };
        this.$emit('input', { ...this.rgba });
      });
    },

    onAlphaMouseDown(e: MouseEvent) {
      startDrag(this, e, (ev: MouseEvent) => {
        const el = this.$refs.alpha as HTMLElement;
        const rect = el.getBoundingClientRect();
        this.internalAlpha = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        this.$emit('input', { ...this.rgba });
      });
    },

    onHexInput(e: Event) {
      const input = e.target as HTMLInputElement;
      const hex = input.value.trim().replace(/^#/, '');
      if (!/^[0-9a-fA-F]{0,8}$/.test(hex)) {
        input.value = this.hexInput;
        return;
      }

      if (hex.length !== 6 && hex.length !== 8) {
        return;
      }

      this.internalAlpha = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;

      this.hsv = rgbToHsv(
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
      );
      this.$emit('input', { ...this.rgba });
    },

    onRgbChange(channel: 'r' | 'g' | 'b', e: Event) {
      const val = clamp(parseInt((e.target as HTMLInputElement).value, 10) || 0, 0, 255);
      const c = { ...this.rgba, [channel]: val };
      this.hsv = rgbToHsv(c.r, c.g, c.b);
      this.$emit('input', { ...this.rgba });
    },

    onAlphaChange(e: Event) {
      const input = e.target as HTMLInputElement;
      const parsed = parseFloat(input.value);
      if (Number.isNaN(parsed)) {
        input.value = this.alphaInput;
        return;
      }

      this.internalAlpha = clamp(parsed, 0, 1);
      this.$emit('input', { ...this.rgba });
    },
  },
});
