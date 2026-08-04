import Dropdown from 'components/shared/Dropdown.vue';
import * as fi from 'node-fontinfo';
import { EFontStyle } from 'obs-studio-node';
import { FontLibraryService } from 'services/font-library';
import { defineComponent, PropType } from 'vue';

import ObsFontSizeSelector from './ObsFontSizeSelector.vue';
import { IGoogleFont } from './ObsInput';

export default defineComponent({
  name: 'GoogleFontSelector',
  emits: ['input'],
  components: { Dropdown, FontSizeSelector: ObsFontSizeSelector },
  props: {
    value: { type: Object as PropType<IGoogleFont>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/GoogleFont/${this.value.face}`,
      fontFamilies: [] as string[],
      fontStyles: [] as string[],
      selectedFamily: '' as string,
      selectedStyle: '' as string,
      actualFamily: '' as string,
      actualStyle: 0 as number,
      isLoading: true,
    };
  },
  created() {
    this.isLoading = true;
    FontLibraryService.instance().getManifest().then((manifest: any) => {
      this.isLoading = false;
      this.fontFamilies = manifest.families.map((family: any) => family.name);
      if (this.value.path) this.updateSelectionFromPath();
    });
  },
  methods: {
    emitInput(eventData: IGoogleFont) {
      this.$emit('input', eventData);
    },
    updateSelectionFromPath() {
      FontLibraryService.instance().lookupFontInfo(this.value.path ?? '').then((info: any) => {
        this.selectedFamily = info.family;
        this.selectedStyle = info.style;
        this.updateStyles();
      });
    },
    updateStyles() {
      if (this.selectedFamily) {
        FontLibraryService.instance().findFamily(this.selectedFamily).then((fam: any) => {
          this.fontStyles = fam.styles.map((sty: any) => sty.name);
        });
      }
    },
    setFamily(familyName: string) {
      this.isLoading = true;
      this.selectedFamily = familyName;
      FontLibraryService.instance().findFamily(familyName).then((family: any) => {
        const style = family.styles[0];
        this.updateStyles();
        this.setStyle(style.name);
      });
    },
    setStyle(styleName: string) {
      this.isLoading = true;
      this.selectedStyle = styleName;
      FontLibraryService.instance().findStyle(this.selectedFamily, styleName).then((style: any) => {
        FontLibraryService.instance().downloadFont(style.file).then((fontPath: string) => {
          const fontInfo = fi.getFontInfo(fontPath);
          if (!fontInfo) {
            this.actualFamily = 'Arial';
            this.actualStyle = 0;
          } else {
            this.actualFamily = fontInfo.family_name;
            this.actualStyle = (fontInfo.italic ? EFontStyle.Italic : 0) | (fontInfo.bold ? EFontStyle.Bold : 0);
          }
          this.emitInput({ ...this.value, path: fontPath, face: this.actualFamily, flags: this.actualStyle });
          this.isLoading = false;
        });
      });
    },
    setSize(size: string) {
      this.emitInput({ ...this.value, size });
    },
  },
});
