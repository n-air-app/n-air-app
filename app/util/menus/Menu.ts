// An abstraction on electron Menus

import * as remote from '@electron/remote';

export class Menu {
  menu: Electron.Menu;

  constructor() {
    this.menu = new remote.Menu();
  }

  popup() {
    this.menu.popup({ window: remote.getCurrentWindow() });
  }

  append(options: Electron.MenuItemConstructorOptions) {
    this.menu.append(new remote.MenuItem(options));
  }

  destroy() {
    for (const item of this.menu.items as any[]) {
      if (item.submenu?.destroy) item.submenu.destroy();
    }
    (this.menu as any).destroy();
  }
}
