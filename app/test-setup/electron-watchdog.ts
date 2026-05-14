// Watchdog that exits this Electron process when the parent Jest runner dies.
// Runs only in the Electron main process (isMain=true) spawned by jest-electron-runner.
// This is a second line of defense in case the jest wrapper process itself crashes
// before tree-kill can clean up.

if (process.env.isMain === 'true') {
  const parentPid = process.ppid;
  const interval = setInterval(() => {
    try {
      process.kill(parentPid, 0); // alive check — sends no actual signal
    } catch {
      clearInterval(interval);
      try {
        require('electron').app.exit(1);
      } catch {
        process.exit(1);
      }
    }
  }, 1000);
  interval.unref(); // don't prevent Jest from exiting normally
}
