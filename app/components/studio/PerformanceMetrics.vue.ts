import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
import { PerformanceService } from 'services/performance';
import { SettingsService } from 'services/settings';
import { StreamingService } from 'services/streaming';
import { SubStreamService } from 'services/substream/SubStreamService';
import { UserService } from 'services/user';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'PerformanceMetrics',

  data() {
    return {
      visitorTooltip: $t('common.numberOfVisitors'),
      commentTooltip: $t('common.numberOfComments'),
      subStreamStatus: '',
      subStreamUse: false,
      subStreamFetching: false,
    };
  },

  computed: {
    isCompactMode() {
      return CompactModeService.instance.isCompactMode;
    },

    isLoggedIn() {
      return UserService.instance.isLoggedIn();
    },

    isStreaming() {
      return StreamingService.instance.isStreaming;
    },

    cpuPercent() {
      return PerformanceService.instance.state.CPU.toFixed(1);
    },

    outputResolution() {
      return SettingsService.instance.state.Video.Output;
    },

    frameRate() {
      if (!CustomizationService.instance.pollingPerformanceStatistics) return '--';
      return PerformanceService.instance.state.frameRate.toFixed(2);
    },

    targetFrameRate() {
      const Video = SettingsService.instance.state.Video;

      // FPSType and related values (FPSCommon, FPSInt, ...) are not guaranteed to be synchronized.
      // So we detect the current type from given values.
      if (Video.FPSCommon) {
        return Video.FPSCommon;
      }

      if (Video.FPSInt) {
        return Video.FPSInt.toString(10);
      }

      if (typeof Video.FPSNum === 'number' && typeof Video.FPSDen === 'number') {
        return (Video.FPSNum / Video.FPSDen).toFixed(2);
      }

      // Return a harmless value because it's not enough to throw an error.
      return '--';
    },

    droppedFrames() {
      if (!CustomizationService.instance.pollingPerformanceStatistics) return '--';
      return PerformanceService.instance.state.numberDroppedFrames;
    },

    percentDropped() {
      if (!CustomizationService.instance.pollingPerformanceStatistics) return '--';
      return (PerformanceService.instance.state.percentageDroppedFrames || 0).toFixed(1);
    },

    bandwidth() {
      if (!CustomizationService.instance.pollingPerformanceStatistics) return '--';
      return PerformanceService.instance.state.streamingBandwidth.toFixed(0);
    },

    bandwidthAlert(): boolean {
      if (!CustomizationService.instance.pollingPerformanceStatistics) return false;
      return this.isStreaming && PerformanceService.instance.state.streamingBandwidth === 0;
    },

    // 配信品質インジケーター
    streamQuality() {
      return PerformanceService.instance.state.streamQuality;
    },

    qualityText() {
      const quality = this.streamQuality;
      if (quality === 'GOOD') return $t('common.performance.qualityGood');
      if (quality === 'FAIR') return $t('common.performance.qualityFair');
      if (quality === 'POOR') return $t('common.performance.qualityPoor');
      return '';
    },

    qualityIconClass() {
      const quality = this.streamQuality;
      return {
        'icon-checkmark': quality === 'GOOD',
        'icon-alert': quality === 'FAIR',
        'icon-error': quality === 'POOR',
      };
    },

    qualityTextClass() {
      const quality = this.streamQuality;
      return {
        'quality-good': quality === 'GOOD',
        'quality-fair': quality === 'FAIR',
        'quality-poor': quality === 'POOR',
      };
    },
  },

  mounted() {
    this.subStreamFetching = true;
    this.reloadSubStreamStatus();
  },

  beforeUnmount() {
    this.subStreamFetching = false;
  },

  methods: {
    async reloadSubStreamStatus() {
      this.subStreamUse = SubStreamService.instance.state.use;
      if (this.subStreamUse) {
        const status = await SubStreamService.instance.getStatus();
        this.subStreamStatus = status.displayStatus;
      } else {
        this.subStreamStatus = '';
      }
      if (!this.subStreamFetching) return;
      window.setTimeout(() => this.reloadSubStreamStatus(), 1000);
    },
  },
});
