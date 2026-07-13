import Dropdown from 'components/shared/Dropdown.vue';
import fontManager from 'font-manager';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import { EFontStyle } from 'obs-studio-node';
import { defineComponent, PropType } from 'vue';

import ObsFontSizeSelector from './ObsFontSizeSelector.vue';
import { IObsFont, IObsInput } from './ObsInput';

interface IFontDescriptor {
  path: string;
  postscriptName: string;
  family: string;
  style: string;
  weight: number;
  width: number;
  italic: boolean;
  oblique: boolean;
  monospace: boolean;
}

interface IFontSelect extends HTMLElement {
  value: IFontDescriptor;
}

export default defineComponent({
  name: 'ObsSystemFontSelector',
  emits: ['input'],
  components: { Dropdown, FontSizeSelector: ObsFontSizeSelector },
  props: {
    value: { type: Object as PropType<IObsInput<IObsFont>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/SystemFont/${this.value.name}`,
      fonts: fontManager.getAvailableFontsSync() as IFontDescriptor[],
    };
  },
  computed: {
    selectedFamily(): { family: string; fonts: IFontDescriptor[] } {
      return this.fontsToFamily(this.fontsByFamily[this.value.value?.face ?? '']);
    },
    selectedFont(): IFontDescriptor | undefined {
      const value = this.value.value;
      if (!value) return undefined;
      return this.selectedFamily.fonts.find((font: IFontDescriptor) => {
        return value.flags === this.getFlagsFromFont(font);
      });
    },
    fontsByFamily(): Dictionary<IFontDescriptor[]> {
      return groupBy(this.fonts, 'family');
    },
    fontFamilies(): { family: string; fonts: IFontDescriptor[] }[] {
      return sortBy(
        Object.values(this.fontsByFamily).map((fonts) => this.fontsToFamily(fonts)),
        'family',
      );
    },
  },
  methods: {
    emitInput(eventData: IObsInput<IObsFont>) {
      this.$emit('input', eventData);
    },
    styleForFont(font: IFontDescriptor) {
      let fontStyle = 'normal';
      if (font.italic) fontStyle = 'italic';
      return {
        fontFamily: font.family,
        fontWeight: font.weight,
        fontStyle,
      };
    },
    fontsToFamily(fonts: IFontDescriptor[]): { family: string; fonts: IFontDescriptor[] } {
      if (fonts) return { family: fonts[0].family, fonts };
      return { family: '', fonts: [] };
    },
    setFamily(family: { family: string; fonts: IFontDescriptor[] }) {
      let selected_font: IFontDescriptor;
      const regular = family.fonts.find((font) => font.style === 'Regular');
      if (regular) {
        selected_font = regular;
      } else {
        selected_font = family.fonts[0];
      }
      this.setFont({
        face: family.family,
        flags: this.getFlagsFromFont(selected_font),
      });
    },
    getFlagsFromFont(font: IFontDescriptor): number {
      return (
        (font.italic ? EFontStyle.Italic : 0)
        | (font.oblique ? EFontStyle.Italic : 0)
        | (font.weight > 400 ? EFontStyle.Bold : 0)
      );
    },
    setStyle(font: IFontDescriptor) {
      this.setFont({ flags: this.getFlagsFromFont(font) });
    },
    setSize(size: string) {
      this.setFont({ size: Number(size) });
    },
    setFont(args: IObsFont) {
      const fontObj = { ...args };
      fontObj.path = '';
      const fontRef = (this.$refs.font as IFontSelect);
      if (fontObj.face === undefined) fontObj.face = fontRef.value.family;
      if (fontObj.size === undefined) fontObj.size = this.value.value?.size;
      if (fontObj.flags === undefined) fontObj.flags = this.getFlagsFromFont(fontRef.value);
      this.emitInput({ ...this.value, value: fontObj });
    },
  },
});
