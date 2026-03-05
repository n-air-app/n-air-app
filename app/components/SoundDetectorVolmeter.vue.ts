import { Subscription } from 'rxjs';
import { AudioSource } from 'services/audio';
import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';

// Configuration
const CHANNEL_HEIGHT = 4;
const PADDING_HEIGHT = 4;
const WARNING_LEVEL = -20;
const DANGER_LEVEL = -9;
const MIN_DB = -60; // Minimum dB level displayed on the meter
const MAX_DB = 0; // Maximum dB level displayed on the meter

// Colors
const GREEN = 'rgba(0,224,79, .4)';
const GREEN_BG = 'rgba(1,85,49, .4)';
const YELLOW = 'rgba(181,224,79, .4)';
const YELLOW_BG = 'rgba(65,85,49, .4)';
const RED = 'rgba(255,31,79, .4)';
const RED_BG = 'rgba(65,20,49, .4)';
const ADVANCED_BG = '#050e18';

@Component({})
export default class SoundDetectorVolmeter extends Vue {
  @Prop() audioSource!: AudioSource;
  @Prop({ default: -19 }) threshold!: number;
  @Prop({ default: true }) enabled!: boolean;

  private volmeterSubscription?: Subscription;

  $refs!: {
    canvas: HTMLCanvasElement;
    spacer: HTMLDivElement;
  };

  private ctx!: CanvasRenderingContext2D;

  private canvasWidth = 0;
  private channelCount = 0;
  private canvasHeight = 0;

  private previousPeaks: number[] = [];
  private hasDrawn = false;

  private resizeObserver?: ResizeObserver;

  get sourceName(): string {
    return this.audioSource.name;
  }

  mounted(): void {
    this.ctx = this.$refs.canvas.getContext('2d')!;
    this.setChannelCount(1);
    this.updateCanvasWidth();
    if (this.enabled) {
      this.subscribeVolmeter();
    } else {
      this.drawVolmeter([-Infinity]);
    }

    // ResizeObserverでサイズ変更を監視
    this.resizeObserver = new ResizeObserver(() => this.updateCanvasWidth());

    const parentElement = this.$refs.canvas.parentElement;
    if (parentElement) this.resizeObserver.observe(parentElement);
  }

  destroyed(): void {
    // ResizeObserverの監視を停止
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.unsubscribeVolmeter();
  }

  private setChannelCount(channels: number): void {
    if (channels === this.channelCount) return;

    this.channelCount = channels;
    this.canvasHeight = channels * (CHANNEL_HEIGHT + PADDING_HEIGHT) - PADDING_HEIGHT;
    this.$refs.canvas.height = this.canvasHeight;
    this.$refs.canvas.style.height = `${this.canvasHeight}px`;
    this.$refs.spacer.style.height = `${this.canvasHeight}px`;

    this.previousPeaks = Array(channels).fill(-65535);
  }

  private updateCanvasWidth(): void {
    const parentElement = this.$refs.canvas.parentElement;
    if (!parentElement) return;

    const width = Math.floor(parentElement.offsetWidth);
    if (width === this.canvasWidth) return;

    this.canvasWidth = width;
    this.$refs.canvas.width = width;
    this.$refs.canvas.style.width = `${width}px`;
    this.hasDrawn = false;

    // キャッシュを更新
    this.recalculatePixelCache();
  }

  private recalculatePixelCache(): void {
    this.warningPx = this.convertDbToPixels(WARNING_LEVEL);
    this.dangerPx = this.convertDbToPixels(DANGER_LEVEL);
    this.thresholdPx = this.convertDbToPixelsWithClipping(this.threshold);
  }

  @Watch('threshold')
  onThresholdChange(): void {
    this.thresholdPx = this.convertDbToPixelsWithClipping(this.threshold);
    this.hasDrawn = false; // Force redraw
  }

  @Watch('enabled')
  onEnabledChange(enabled: boolean): void {
    if (enabled) {
      this.subscribeVolmeter();
    } else {
      this.unsubscribeVolmeter();
      this.drawVolmeter([-Infinity]);
      this.hasDrawn = false;
    }
  }

  private convertDbToPixelsWithClipping(db: number): number {
    // Clamp threshold to visible range
    const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, db));
    return this.convertDbToPixels(clampedDb);
  }

  private drawVolmeter(peaks: number[]): void {
    this.ctx.fillStyle = ADVANCED_BG;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    peaks.forEach((peak, channel) => {
      this.drawVolmeterChannel(peak, channel);
    });

    // Draw threshold line
    this.drawThresholdLine();
  }

  // キャッシュ用プロパティ
  private warningPx = 0;
  private dangerPx = 0;
  private thresholdPx = 0;

  private drawVolmeterChannel(peak: number, channel: number): void {
    const heightOffset = channel * (CHANNEL_HEIGHT + PADDING_HEIGHT);
    const peakPx = this.convertDbToPixels(peak);

    // 背景描画
    this.drawChannelBackground(heightOffset);

    // ピークレベル描画
    this.drawPeakLevel(peak, peakPx, heightOffset);
  }

  private drawChannelBackground(heightOffset: number): void {
    this.ctx.fillStyle = GREEN_BG;
    this.ctx.fillRect(0, heightOffset, this.warningPx, CHANNEL_HEIGHT);
    this.ctx.fillStyle = YELLOW_BG;
    this.ctx.fillRect(this.warningPx, heightOffset, this.dangerPx - this.warningPx, CHANNEL_HEIGHT);
    this.ctx.fillStyle = RED_BG;
    this.ctx.fillRect(
      this.dangerPx,
      heightOffset,
      this.canvasWidth - this.dangerPx,
      CHANNEL_HEIGHT,
    );
  }

  private drawPeakLevel(peak: number, peakPx: number, heightOffset: number): void {
    // Green level
    const greenLevel = Math.min(peakPx, this.warningPx);
    if (greenLevel <= 0) return;

    this.ctx.fillStyle = GREEN;
    this.ctx.fillRect(0, heightOffset, greenLevel, CHANNEL_HEIGHT);

    // Yellow level
    if (peak <= WARNING_LEVEL) return;

    const yellowLevel = Math.min(peakPx, this.dangerPx);
    this.ctx.fillStyle = YELLOW;
    this.ctx.fillRect(this.warningPx, heightOffset, yellowLevel - this.warningPx, CHANNEL_HEIGHT);

    // Red level
    if (peak <= DANGER_LEVEL) return;

    this.ctx.fillStyle = RED;
    this.ctx.fillRect(this.dangerPx, heightOffset, peakPx - this.dangerPx, CHANNEL_HEIGHT);
  }

  private drawThresholdLine(): void {
    // Draw threshold line with black outline for visibility
    // First draw black outline (thicker)
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.lineWidth = 4;

    this.ctx.beginPath();
    this.ctx.moveTo(this.thresholdPx, 0);
    this.ctx.lineTo(this.thresholdPx, this.canvasHeight);
    this.ctx.stroke();

    // Then draw white line on top (thinner)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.moveTo(this.thresholdPx, 0);
    this.ctx.lineTo(this.thresholdPx, this.canvasHeight);
    this.ctx.stroke();
  }

  private convertDbToPixels(db: number): number {
    const dbRange = MAX_DB - MIN_DB;
    return Math.round((db - MIN_DB) * (this.canvasWidth / dbRange));
  }

  private checkPeaks(peaks: number[]): boolean {
    if (peaks.length !== this.channelCount) {
      this.hasDrawn = false;
      return false;
    }

    let changed = false;
    peaks.forEach((peak, channel) => {
      // 変化がなければ再描画しない
      if (peak !== this.previousPeaks[channel]) changed = true;

      this.previousPeaks[channel] = peak;
    });

    return !changed && this.hasDrawn;
  }

  private subscribeVolmeter(): void {
    this.volmeterSubscription = this.audioSource
      .getVolmeterStream()
      .subscribe(volmeter => {
        // 複数チャンネルの場合は最大値を取って1本のバーにまとめる
        const maxPeak = volmeter.peak.length > 0
          ? Math.max(...volmeter.peak)
          : -Infinity;
        const singlePeak = [maxPeak];

        if (this.checkPeaks(singlePeak)) return;
        this.setChannelCount(1);
        this.drawVolmeter(singlePeak);
        this.hasDrawn = true;
      });
  }

  private unsubscribeVolmeter(): void {
    if (this.volmeterSubscription) this.volmeterSubscription.unsubscribe();
  }
}
