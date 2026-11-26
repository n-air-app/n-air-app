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
 * Timing utilities for measuring release process duration
 */

/** @type {Map<string, {start: number, end?: number}>} */
const timings = new Map();

/**
 * Format milliseconds as "Xm Ys" or "Xs"
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Start timing a named phase
 * @param {string} phaseName
 */
function startPhase(phaseName) {
  if (!colors) colors = require('colors/safe');
  timings.set(phaseName, { start: Date.now() });
  sh.echo(colors.cyan(`▶ [${phaseName}] started`));
}

/**
 * End timing a named phase and log the duration
 * @param {string} phaseName
 */
function endPhase(phaseName) {
  if (!colors) colors = require('colors/safe');
  const timing = timings.get(phaseName);
  if (!timing) {
    sh.echo(colors.yellow(`⚠ [${phaseName}] was not started`));
    return;
  }
  timing.end = Date.now();
  const duration = timing.end - timing.start;
  sh.echo(colors.green(`✓ [${phaseName}] completed in ${formatDuration(duration)}`));
}

/**
 * Run a function and measure its duration
 * @template T
 * @param {string} phaseName
 * @param {() => T} fn
 * @returns {T}
 */
function withTiming(phaseName, fn) {
  startPhase(phaseName);
  try {
    const result = fn();
    endPhase(phaseName);
    return result;
  } catch (e) {
    endPhase(phaseName);
    throw e;
  }
}

/**
 * Run an async function and measure its duration
 * @template T
 * @param {string} phaseName
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTimingAsync(phaseName, fn) {
  startPhase(phaseName);
  try {
    const result = await fn();
    endPhase(phaseName);
    return result;
  } catch (e) {
    endPhase(phaseName);
    throw e;
  }
}

/**
 * Print a summary of all timed phases
 */
function printTimingSummary() {
  if (!colors) colors = require('colors/safe');
  sh.echo('');
  sh.echo(colors.magenta('=== Timing Summary ==='));
  let total = 0;
  for (const [name, timing] of timings) {
    if (timing.end) {
      const duration = timing.end - timing.start;
      total += duration;
      sh.echo(`  ${name}: ${formatDuration(duration)}`);
    }
  }
  sh.echo(colors.magenta('  ────────────────────'));
  sh.echo(colors.magenta(`  Total: ${formatDuration(total)}`));
  sh.echo('');
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
  // Timing utilities
  startPhase,
  endPhase,
  withTiming,
  withTimingAsync,
  printTimingSummary,
};
