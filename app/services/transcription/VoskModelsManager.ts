import { existsSync } from 'fs';
import path from 'path';
import { $t } from 'services/i18n';
import { VOSK_MODEL_NAMES, VoskModelStatus } from './transcription';

export class VoskModelsManager {
  private models: { name: string; description: string; status: VoskModelStatus }[] =
    VOSK_MODEL_NAMES.map(name => ({
      name,
      description: $t(`settings.transcription.voskModel.${name}`),
      status: { state: 'not_downloaded' },
    }));

  constructor(private modelBasePath: string) {
    this.models = this.models.map(model => {
      const modelPath = this.getModelPath(model.name);
      if (existsSync(modelPath)) {
        model.status = { state: 'downloaded' };
      }
      return model;
    });
  }

  getModelPath(modelName: string): string {
    return path.join(this.modelBasePath, modelName);
  }

  getVoskModels(): {
    name: string;
    description: string;
    status: VoskModelStatus;
  }[] {
    return this.models;
  }

  setVoskModelStatus(modelName: string, status: VoskModelStatus) {
    const model = this.models.find(m => m.name === modelName);
    if (model) {
      model.status = status;
    }
  }
  getVoskModelStatus(modelName: string): VoskModelStatus {
    const model = this.models.find(m => m.name === modelName);
    return model ? model.status : { state: 'not_downloaded' };
  }
}
