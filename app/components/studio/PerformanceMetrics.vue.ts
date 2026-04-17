import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { PerformanceService } from 'services/performance';
import { SettingsService } from 'services/settings';
import { StreamingService } from 'services/streaming';
import { SubStreamService } from 'services/substream/SubStreamService';
import { UserService } from 'services/user';

@Component({})
export default class PerformanceMetrics extends Vue {
  @Inject() streamingService: StreamingService;
  @Inject() performanceService: PerformanceService;
  @Inject() userService: UserService;
  @Inject() settingsService: SettingsService;
  @Inject() customizationService: CustomizationService;
  @Inject() compactModeService: CompactModeService;
  @Inject() subStreamService: SubStreamService;

  visitorTooltip = $t('common.numberOfVisitors');
  commentTooltip = $t('common.numberOfComments');

  subStreamStatus = '';
  subStreamUse = false;
  subStreamFetching = false;

  get isCompactMode() {
    return this.compactModeService.isCompactMode;
  }

  get isLoggedIn() {
    return this.userService.isLoggedIn();
  }

  get isStreaming() {
    return this.streamingService.isStreaming;
  }

  get cpuPercent() {
    return this.performanceService.state.CPU.toFixed(1);
  }

  get outputResolution() {
    return this.settingsService.state.Video.Output;
  }

  get frameRate() {
    if (!this.customizationService.pollingPerformanceStatistics) return '--';
    return this.performanceService.state.frameRate.toFixed(2);
  }

  get targetFrameRate() {
    const Video = this.settingsService.state.Video;

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
  }

  get droppedFrames() {
    if (!this.customizationService.pollingPerformanceStatistics) return '--';
    return this.performanceService.state.numberDroppedFrames;
  }

  get percentDropped() {
    if (!this.customizationService.pollingPerformanceStatistics) return '--';
    return (this.performanceService.state.percentageDroppedFrames || 0).toFixed(1);
  }

  get bandwidth() {
    if (!this.customizationService.pollingPerformanceStatistics) return '--';
    return this.performanceService.state.streamingBandwidth.toFixed(0);
  }

  get bandwidthAlert(): boolean {
    if (!this.customizationService.pollingPerformanceStatistics) return false;
    return this.isStreaming && this.performanceService.state.streamingBandwidth === 0;
  }

  // 配信品質インジケーター
  get streamQuality() {
    return this.performanceService.state.streamQuality;
  }

  get qualityText() {
    const quality = this.streamQuality;
    if (quality === 'GOOD') return $t('common.performance.qualityGood');
    if (quality === 'FAIR') return $t('common.performance.qualityFair');
    if (quality === 'POOR') return $t('common.performance.qualityPoor');
    return '';
  }

  get qualityIconClass() {
    const quality = this.streamQuality;
    return {
      'icon-checkmark': quality === 'GOOD',
      'icon-alert': quality === 'FAIR',
      'icon-error': quality === 'POOR',
    };
  }

  get qualityTextClass() {
    const quality = this.streamQuality;
    return {
      'quality-good': quality === 'GOOD',
      'quality-fair': quality === 'FAIR',
      'quality-poor': quality === 'POOR',
    };
  }

  async reloadSubStreamStatus() {
    this.subStreamUse = this.subStreamService.state.use;
    if (this.subStreamUse) {
      const status = await this.subStreamService.getStatus();
      this.subStreamStatus = status.displayStatus;
    } else {
      this.subStreamStatus = '';
    }
    if (!this.subStreamFetching) return;
    window.setTimeout(() => this.reloadSubStreamStatus(), 1000);
  }

  mounted() {
    this.subStreamFetching = true;
    this.reloadSubStreamStatus();
  }

  beforeDestroy() {
    this.subStreamFetching = false;
  }
}
