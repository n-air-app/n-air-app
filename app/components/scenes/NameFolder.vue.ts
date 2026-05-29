import ModalLayout from 'components/shared/ModalLayout.vue';
import { $t } from 'services/i18n';
import { ScenesService } from 'services/scenes';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'NameFolder',

  components: { ModalLayout },

  data() {
    return {
      options: WindowsService.instance().getChildWindowQueryParams() as {
        renameId?: string;
        itemsToGroup?: string[];
        parentId?: string;
      },
      name: '',
      error: '',
    };
  },

  mounted() {
    if (this.options.renameId) {
      this.name = ScenesService.instance().activeScene.getFolder(this.options.renameId).name;
    } else {
      this.name = ScenesService.instance().suggestName($t('sources.newFolderName'));
    }
  },

  methods: {
    submit() {
      if (!this.name) {
        this.error = $t('sources.sourceNameIsRequired');
      } else if (this.options.renameId) {
        const folder = ScenesService.instance().activeScene.getFolder(this.options.renameId);
        folder.setName(this.name);
        WindowsService.instance().closeChildWindow();
      } else {
        const scene = ScenesService.instance().activeScene;
        const newFolder = ScenesService.instance().activeScene.createFolder(this.name);

        if (this.options.itemsToGroup) {
          ScenesService.instance().activeScene
            .getSelection(this.options.itemsToGroup)
            .moveTo(scene.id, newFolder.id);
          if (this.options.parentId) {
            newFolder.setParent(this.options.parentId);
          }
        }
        newFolder.select();

        WindowsService.instance().closeChildWindow();
      }
    },
  },
});
