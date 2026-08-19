import ConnectionSettings from 'components/settings/ConnectionSettings.vue';
import TransitionSettings from 'components/settings/TransitionSettings.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import Tabs from 'components/shared/Tabs.vue';
import { $t } from 'services/i18n';
import { ScenesService } from 'services/scenes';
import { ETransitionType, TransitionsService } from 'services/transitions';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

interface ITab {
  name: string;
  value: string;
}

export default defineComponent({
  name: 'SceneTransitions',
  components: {
    ModalLayout,
    TransitionSettings,
    Tabs,
    ConnectionSettings,
  },
  data() {
    return {
      inspectedTransition: '',
      inspectedConnection: '',
      showTransitionSettings: false,
      showConnectionSettings: false,
      tabs: [
        { name: $t('transitions.transitions'), value: 'transitions' },
        { name: $t('transitions.connections'), value: 'connections' },
      ] as ITab[],
      selectedTab: 'transitions',
      redundantConnectionTooltip: $t('transitions.redundantConnectionTooltip'),
    };
  },
  computed: {
    transitionsEnabled() {
      return ScenesService.instance().scenes.length > 1;
    },
    transitions() {
      return TransitionsService.instance().state.transitions;
    },
    defaultTransitionId() {
      return TransitionsService.instance().state.defaultTransitionId;
    },
    connections() {
      return TransitionsService.instance().state.connections;
    },
  },
  methods: {
    addTransition() {
      const transition = TransitionsService.instance().createTransition(
        ETransitionType.Cut,
        $t('transitions.newTransition'),
      );
      if (transition) this.editTransition(transition.id);
    },
    editTransition(id: string) {
      this.inspectedTransition = id;
      this.showTransitionSettings = true;
    },
    deleteTransition(id: string) {
      if (TransitionsService.instance().state.transitions.length === 1) {
        alert($t('transitions.mustHaveLeastOneTransition'));
        return;
      }
      TransitionsService.instance().deleteTransition(id);
    },
    makeDefault(id: string) {
      TransitionsService.instance().setDefaultTransition(id);
    },
    addConnection() {
      const connection = TransitionsService.instance().addConnection(
        ScenesService.instance().scenes[0].id,
        ScenesService.instance().scenes[1].id,
        this.transitions[0]!.id,
      );
      if (connection) this.editConnection(connection.id);
    },
    editConnection(id: string) {
      this.inspectedConnection = id;
      this.showConnectionSettings = true;
    },
    deleteConnection(id: string) {
      TransitionsService.instance().deleteConnection(id);
    },
    getTransitionName(id: string) {
      const transition = TransitionsService.instance().getTransition(id);
      if (transition) return transition.name;
      return `<${$t('transitions.deleted')}>`;
    },
    getSceneName(id: string) {
      const scene = ScenesService.instance().getScene(id);
      if (scene) return scene.name;
      return `<${$t('transitions.deleted')}>`;
    },
    isConnectionRedundant(id: string) {
      return TransitionsService.instance().isConnectionRedundant(id);
    },
    nameForType(type: ETransitionType) {
      return TransitionsService.instance().getTypes().find((t) => t.value === type)?.description ?? '';
    },
    done() {
      WindowsService.instance().closeChildWindow();
    },
    dismissModal(modal: string) {
      if (modal === 'transition-settings') {
        this.showTransitionSettings = false;
      } else if (modal === 'connection-settings') {
        this.showConnectionSettings = false;
      }
    },
  },
});

