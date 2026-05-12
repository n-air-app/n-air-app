import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { $t } from 'services/i18n';

export const VOSK_MODEL_NAMES = ['vosk-model-small-ja-0.22', 'vosk-model-ja-0.22'] as const;

export type VoskModelStatus = {
  state: 'not_downloaded' | 'downloading' | 'installing' | 'downloaded' | 'download_error' | 'load_error' | 'cancelled';
  progress?: number; // percentage of download completion
  error_message?: string;
};

export class VoskModelsManager {
  private models: {
    name: string;
    description: string;
    status: VoskModelStatus;
  }[] = VOSK_MODEL_NAMES.map((name) => ({
      name,
      description: $t(`settings.transcription.voskModels['${name}']`),
      status: { state: 'not_downloaded' },
    }));

  constructor(private modelBasePath: string) {
    this.models = this.models.map((model) => {
      const modelPath = this.getModelPath(model.name);
      if (existsSync(modelPath)) {
        model.status = { state: 'downloaded' };
      }
      return model;
    });
  }

  getModelPath(modelName: string): string {
    return join(this.modelBasePath, modelName);
  }

  getVoskModels(): {
    name: string;
    description: string;
    status: VoskModelStatus;
  }[] {
    return this.models;
  }

  setVoskModelStatus(modelName: string, status: VoskModelStatus) {
    const model = this.models.find((m) => m.name === modelName);
    if (model) {
      model.status = status;
    }
  }
  getVoskModelStatus(modelName: string): VoskModelStatus {
    const model = this.models.find((m) => m.name === modelName);
    return model ? model.status : { state: 'not_downloaded' };
  }
}
