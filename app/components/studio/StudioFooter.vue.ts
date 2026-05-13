import PerformanceMetrics from 'components/studio/PerformanceMetrics.vue';
import StreamingController from 'components/studio/StreamingController.vue';
import { CompactModeService } from 'services/compact-mode';
import { Inject } from 'services/core/injector';
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';

@Component({
  components: {
    StreamingController,
    PerformanceMetrics,
  },
})
export default class StudioFooterComponent extends Vue {
  @Inject() private compactModeService: CompactModeService;

  @Prop() locked: boolean;

  get isCompactMode() {
    return this.compactModeService.isCompactMode;
  }
}
