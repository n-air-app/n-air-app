import * as remote from '@electron/remote';
import TitleBar from 'components/studio/TitleBar.vue';
import { getComponents, IWindowOptions, WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ChildWindow',

  components: {
    TitleBar,
    ...getComponents(),
  },

  data() {
    return {
      components: [] as { name: string; isShown: boolean; title: string }[],
      refreshingTimeout: 0,
    };
  },

  mounted() {
    this.onWindowUpdatedHandler(this.options);
    WindowsService.instance().windowUpdated.subscribe((windowInfo: { windowId: string; options: IWindowOptions }) => {
      if (windowInfo.windowId !== 'child') return;
      this.onWindowUpdatedHandler(windowInfo.options);
    });
  },

  computed: {
    options() {
      return WindowsService.instance().state.child;
    },

    currentComponent(): { name: string; isShown: boolean; title: string } {
      return this.components[this.components.length - 1];
    },
  },

  methods: {
    clearComponentStack() {
      this.components = [];
    },

    setWindowTitle() {
      remote.getCurrentWindow().setTitle(this.currentComponent.title);
    },

    onWindowUpdatedHandler(options: IWindowOptions) {
      // If the window was closed, just clear the stack
      if (!options.isShown) {
        this.clearComponentStack();
        return;
      }

      if (options.preservePrevWindow) {
        this.currentComponent.isShown = false;
        this.components.push({ name: options.componentName, isShown: true, title: options.title });
        this.setWindowTitle();
        return;
      }

      if (options.isPreserved) {
        this.components.pop();
        this.currentComponent.isShown = true;
        this.setWindowTitle();
        return;
      }

      this.clearComponentStack();

      // This is essentially a race condition, but make a best effort
      // at having a successful paint cycle before loading a component
      // that will do a bunch of synchronous IO.
      clearTimeout(this.refreshingTimeout);
      this.refreshingTimeout = window.setTimeout(() => {
        this.components.push({ name: options.componentName, isShown: true, title: options.title });
        this.setWindowTitle();
      }, 50);
    },
  },
});
