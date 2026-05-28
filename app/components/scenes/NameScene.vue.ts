import ModalLayout from 'components/shared/ModalLayout.vue';
import { $t } from 'services/i18n';
import { ScenesService } from 'services/scenes';
import { SelectionService } from 'services/selection';
import { SourcesService } from 'services/sources';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'NameScene',

  components: { ModalLayout },

  data() {
    return {
      name: '',
      error: '',
      options: WindowsService.instance.getChildWindowQueryParams() as {
        sceneToDuplicate?: string;
        rename?: string;
        itemsToGroup?: string[];
      },
    };
  },

  mounted() {
    let name = '';

    if (this.options.rename) {
      name = ScenesService.instance.getScene(this.options.rename).name;
      this.name = name;
    } else if (this.options.sceneToDuplicate) {
      name = ScenesService.instance.getScene(this.options.sceneToDuplicate).name;
    } else if (this.options.itemsToGroup) {
      name = $t('scenes.newSceneGroupName', {
        activeSceneName: ScenesService.instance.activeScene.name,
      });
    } else {
      name = $t('scenes.newSceneName');
    }
    if (!this.options.rename) this.name = SourcesService.instance.suggestName(name);
  },

  methods: {
    submit() {
      const activeScene = ScenesService.instance.activeScene;

      if (!this.name) {
        this.error = $t('scenes.nameIsRequired');
      } else if (this.options.rename) {
        ScenesService.instance.getScene(this.options.rename).setName(this.name);
        WindowsService.instance.closeChildWindow();
      } else {
        const newScene = ScenesService.instance.createScene(this.name, {
          duplicateSourcesFromScene: this.options.sceneToDuplicate,
        });
        if (this.options.itemsToGroup) {
          activeScene.getSelection(this.options.itemsToGroup).moveTo(newScene.id);
          const sceneItem = activeScene.addSource(newScene.id);
          SelectionService.instance.select(sceneItem.sceneItemId);
          sceneItem.setContentCrop();
        } else {
          newScene.makeActive();
        }
        WindowsService.instance.closeChildWindow();
      }
    },
  },
});
