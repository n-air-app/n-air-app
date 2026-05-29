// An abstraction on electron Menus

import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';

export class Menu {
  menu: Electron.Menu;

  constructor() {
    this.menu = new remote.Menu();
  }

  popup() {
    this.menu.popup({ window: remote.getCurrentWindow() });
  }

  append(options: Electron.MenuItemConstructorOptions) {
    const { click } = options;
    if (click) {
      this.menu.append(
        new remote.MenuItem({
          ...options,
          click: (...args) => {
            Sentry.addBreadcrumb({
              category: 'ui.menu',
              message: String(options.id ?? options.label ?? '(unknown)'),
              level: 'info',
            });
            click(...args);
          },
        }),
      );
    } else {
      this.menu.append(new remote.MenuItem(options));
    }
  }

  destroy() {
    this.menu.items.forEach((item: any) => {
      if (item.submenu && item.submenu.destroy) item.submenu.destroy();
    });
    (this.menu as any).destroy();
  }
}
