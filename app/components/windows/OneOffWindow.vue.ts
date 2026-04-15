import TitleBar from 'components/studio/TitleBar.vue';
import { Inject } from 'services/core/injector';
import Util from 'services/utils';
import { getComponents, WindowsService } from 'services/windows';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: {
    TitleBar,
    ...getComponents(),
  },
})
export default class OneOffWindow extends Vue {
  @Inject() private windowsService: WindowsService;

  get options() {
    return this.windowsService.state[this.windowId];
  }

  get windowId() {
    return Util.getCurrentUrlParams().windowId;
  }
}
