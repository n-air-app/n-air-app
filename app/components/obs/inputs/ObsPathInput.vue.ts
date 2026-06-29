import * as remote from '@electron/remote';
import { defineComponent, PropType } from 'vue';

import { IObsPathInputValue, TObsType } from './ObsInput';

import OpenDialogOptions = Electron.OpenDialogOptions;

const ObsPathInput = defineComponent({
  name: 'ObsPathInput',
  props: {
    value: { type: Object as PropType<IObsPathInputValue>, required: true as const },
    category: { type: String },
    subCategory: { type: String },
  },
  data() {
    return {
      testingAnchor: `Form/Path/${this.value.name}`,
    };
  },
  methods: {
    emitInput(eventData: IObsPathInputValue) {
      this.$emit('input', eventData);
    },
    async showFileDialog() {
      const options: OpenDialogOptions = {
        defaultPath: this.value.value,
        filters: this.value.filters,
        properties: [],
      };
      if (this.value.type === 'OBS_PROPERTY_FILE') {
        options.properties!.push('openFile');
      }
      if (this.value.type === 'OBS_PROPERTY_PATH') {
        options.properties!.push('openDirectory');
      }
      const { filePaths } = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), options);
      if (filePaths[0]) {
        (this.$refs.input as HTMLInputElement).value = filePaths[0];
        this.handleChange();
      }
    },
    handleChange() {
      this.emitInput({ ...this.value, value: (this.$refs.input as HTMLInputElement).value });
    },
  },
});
export default Object.assign(ObsPathInput, { obsType: ['OBS_PROPERTY_PATH', 'OBS_PROPERTY_FILE'] as TObsType[] });
