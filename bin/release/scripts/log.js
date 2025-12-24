// @ts-check

const sh = require('shelljs');
let colors; // Lazy load to avoid requiring 'colors' when not needed

/**
 * @param {string[]} msg
 */
function log(...msg) {
  sh.echo(...msg);
}

/**
 * @param {string} msg
 */
function info(msg) {
  if (!colors) colors = require('colors/safe');
  sh.echo(colors.magenta(msg));
}

/**
 * @param {string} msg
 */
function error(msg) {
  if (!colors) colors = require('colors/safe');
  sh.echo(colors.red(`ERROR: ${msg}`));
}

function executeCmd(cmd, options) {
  log(`Executing: ${cmd}`);
  const result = /** @type {sh.ExecOutputReturnValue} */ (sh.exec(cmd, options));

  if (result.code !== 0) {
    error(`Command Failed >>> ${cmd}`);
    sh.exit(1);
  }

  // returns {code:..., stdout:..., stderr:...}
  return result;
}

module.exports = {
  log,
  info,
  error,
  executeCmd,
};
