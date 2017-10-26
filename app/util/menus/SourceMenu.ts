import { Inject } from '../../services/service';
import { Menu } from './Menu';
import { SourceTransformMenu } from './SourceTransformMenu';
import windowManager from '../WindowManager';
import { ScenesService } from '../../services/scenes';

export class SourceMenu extends Menu {

  @Inject()
  private scenesService: ScenesService;

  private source = this.scenesService.getScene(this.sceneId).getSource(this.sourceId);

  constructor(private sceneId: string, private sourceId: string) {
    super();

    this.appendMenuItems();
  }


  appendMenuItems() {
    if (this.source.video) {
      this.append({
        label: 'Transform',
        submenu: this.transformSubmenu().menu
      });

      const visibilityLabel = this.source.visible ? 'Hide' : 'Show';

      this.append({
        label: visibilityLabel,
        click: () => {
          this.source.setVisibility(!this.source.visible);
        }
      });
    }

    this.append({
      label: 'Filters',
      click: () => {
        this.showFilters();
      }
    });

    this.append({
      label: 'Properties',
      click: () => {
        this.showProperties();
      }
    });
  }

  transformSubmenu() {
    return new SourceTransformMenu(this.sceneId, this.sourceId);
  }


  showFilters() {
    // TODO: This should take an id
    windowManager.showSourceFilters(this.source.name);
  }


  showProperties() {
    windowManager.showSourceProperties(this.sourceId);
  }

}