import { defineComponent, PropType } from 'vue';

import GoogleFontSelector from './ObsGoogleFontSelector.vue';
import { IGoogleFont, IObsFont, IObsInput, TObsType } from './ObsInput';
import ObsSystemFontSelector from './ObsSystemFontSelector.vue';

const ObsFontInput = defineComponent({
  name: 'ObsFontInput',
  components: { GoogleFontSelector, SystemFontSelector: ObsSystemFontSelector },
  props: {
    value: { type: Object as PropType<IObsInput<IObsFont>>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Font/${this.value.name}`,
      isGoogleFont: !!this.value.value?.path,
    };
  },
  computed: {
    googleFont(): IGoogleFont {
      const value = this.value.value;
      return {
        path: value?.path,
        face: value?.face ?? '',
        flags: value?.flags ?? 0,
        size: String(value?.size ?? ''),
      };
    },
  },
  methods: {
    emitInput(eventData: IObsInput<IObsFont>) {
      this.$emit('input', eventData);
    },
    setFont(font: IObsInput<IObsFont>) {
      this.emitInput(font);
    },
    setGoogleFont(font: IGoogleFont) {
      this.emitInput({
        ...this.value,
        value: {
          path: font.path,
          face: font.face,
          flags: font.flags,
          size: Number(font.size),
        },
      });
    },
    setFontType(e: Event) {
      this.isGoogleFont = (e.target as HTMLInputElement)['checked'];
    },
  },
});
export default Object.assign(ObsFontInput, { obsType: 'OBS_PROPERTY_FONT' as TObsType });
