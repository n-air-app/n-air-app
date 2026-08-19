/**
 * This file provides patches for node:test that allow to track failed tests to re-run them
 * Also it skips the tests that should be run on an different CI agent in a parallel execution mode
 */

import assert from 'node:assert/strict';
import {
  after,
  afterEach,
  before,
  beforeEach,
  test as nodeTest,
} from 'node:test';

import { tasklist } from 'tasklist';

import { sleep } from '../../../app/util/sleep';

import type { ITestContext } from './index';

const fs = require('fs');
const kill = require('tree-kill');

export interface ITestStats {
  duration: number;
  syncIPCCalls: number;
}

export interface ITestExecutionContext {
  context: ITestContext;
  failed: boolean;
  title: string;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
  fail(message?: string): never;
  false(value: unknown, message?: string): void;
  is(actual: unknown, expected: unknown, message?: string): void;
  pass(): void;
  true(value: unknown, message?: string): void;
  truthy(value: unknown, message?: string): void;
}

type TestImplementation = (t: ITestExecutionContext) => void | Promise<void>;
type HookImplementation = (t: ITestExecutionContext) => void | Promise<void>;

interface ITestFn {
  (title: string, implementation: TestImplementation): void;
  after: ((implementation: HookImplementation) => void) & {
    always(implementation: HookImplementation): void;
  };
  afterEach: ((implementation: HookImplementation) => void) & {
    always(implementation: HookImplementation): void;
  };
  before(implementation: HookImplementation): void;
  beforeEach(implementation: HookImplementation): void;
  skip(title: string, implementation?: TestImplementation): void;
  todo(title: string): void;
}

let currentContext: ITestExecutionContext;

function createExecutionContext(title: string): ITestExecutionContext {
  return {
    context: {} as ITestContext,
    failed: false,
    title,
    deepEqual: (actual, expected, message) => assert.deepStrictEqual(actual, expected, message),
    fail: (message) => assert.fail(message),
    false: (value, message) => assert.ok(!value, message),
    is: (actual, expected, message) => assert.strictEqual(actual, expected, message),
    pass: () => undefined,
    true: (value, message) => assert.ok(value, message),
    truthy: (value, message) => assert.ok(value, message),
  };
}

function wrapHook(
  hook: typeof beforeEach | typeof afterEach | typeof before | typeof after,
  createContext = false,
) {
  return (implementation: HookImplementation) => {
    hook(async (context) => {
      if (createContext || !currentContext) currentContext = createExecutionContext(context.name);
      await implementation(currentContext);
    });
  };
}

const {
  BUILD_BUILDID,
  SYSTEM_JOBID,
  BUILD_REASON,
  BUILD_SOURCEBRANCH,
  SYSTEM_JOBNAME,
  BUILD_DEFINITIONNAME,
  SLOBS_TEST_RUN_CHUNK,
} = process.env;

// export const USER_POOL_TOKEN = process.env.SLOBS_TEST_USER_POOL_TOKEN;
// const USER_POOL_URL = 'https://slobs-users-pool.herokuapp.com'; // 'http://localhost:5000'
const FAILED_TESTS_PATH = 'test-dist/failed-tests.json'; // failed will be written down to this file
const TESTS_TIMINGS_PATH = 'test-dist/test-timings.json'; // a known timings for tests should be provided in this file
const TEST_STATS_PATH = 'test-dist/test-stats.json'; // each successfully completed tests save stats like duration, syncIPCCalls in this file

// save names of all running tests in this array to use them in the retrying mechanism
const pendingTests: string[] = [];

// read timings for tests
const testTimings: Record<string, number> = (() => {
  try {
    // read the list of timings from the file
    const records: { name: string; time: number }[] = JSON.parse(
      fs.readFileSync(TESTS_TIMINGS_PATH, 'utf-8'),
    );
    const result: Record<string, number> = {};

    // convert the list to the map where key is a test name
    records.forEach((r) => (result[r.name] = r.time));
    return result;
  } catch (e: unknown) {
    return {};
  }
})();

/**
 * Overridden version of node:test that applies CI sharding and the existing
 * assertion/context API used by the end-to-end tests.
 */
export const testFn = ((testName: string, implementation: TestImplementation) => {
  if (!isTestEligibleToRun(testName)) {
    // skip tests that don't belong current slice
    nodeTest.skip(`SKIP: ${testName}`);
    return;
  }
  pendingTests.push(testName);
  saveFailedTestsToFile([testName]);
  nodeTest(testName, { timeout: 180000 }, async () => {
    try {
      await implementation(currentContext);
    } catch (error) {
      currentContext.failed = true;
      throw error;
    }
  });
}) as ITestFn;

testFn.before = wrapHook(before);
testFn.beforeEach = wrapHook(beforeEach, true);
testFn.after = wrapHook(after) as typeof testFn.after;
testFn.after.always = testFn.after;
testFn.afterEach = wrapHook(afterEach) as typeof testFn.afterEach;
testFn.afterEach.always = testFn.afterEach;
testFn.skip = (title) => nodeTest.skip(title);
testFn.todo = (title) => nodeTest.todo(title);

export function saveFailedTestsToFile(failedTests: string[]) {
  if (fs.existsSync(FAILED_TESTS_PATH)) {
    // tslint:disable-next-line:no-parameter-reassignment TODO
    failedTests = JSON.parse(fs.readFileSync(FAILED_TESTS_PATH, 'utf8')).concat(failedTests);
  }
  fs.writeFileSync(FAILED_TESTS_PATH, JSON.stringify([...new Set(failedTests)]));
}

export function removeFailedTestFromFile(testName: string) {
  if (fs.existsSync(FAILED_TESTS_PATH)) {
    const failedTests = JSON.parse(fs.readFileSync(FAILED_TESTS_PATH, 'utf8'));
    failedTests.splice(failedTests.indexOf(testName), 1);
    fs.writeFileSync(FAILED_TESTS_PATH, JSON.stringify(failedTests));
  }
}

/**
 * check if test is eligible to run on the current CI agent
 */
function isTestEligibleToRun(testName: string) {
  const testAvgTime = testTimings[testName];

  // if we don't have a timing data for test then it's always eligible to run
  if (!testAvgTime) return true;

  // determine which chunk of the test suite is running now
  const chunk = process.env.SLOBS_TEST_RUN_CHUNK;

  // always allow test to run if no chunk data provided
  if (!chunk) return true;

  // get the amount of chunks and the chunk we should run on this agent
  const [currentChunkNum, totalChunks] = chunk.split('/').map((s) => Number(s));

  // calculate the chunk number for the current test
  let testAvgStartTime = 0;
  let testAvgTotalTime = 0;
  Object.keys(testTimings).forEach((name) => {
    testAvgTotalTime += testTimings[name];
    if (name === testName) testAvgStartTime = testAvgTotalTime;
  });
  const timePerChunk = testAvgTotalTime / totalChunks;
  const testChunkNum = Math.floor(testAvgStartTime / timePerChunk) + 1;
  return testChunkNum === currentChunkNum;
}

export function saveTestStatsToFile(stats: Record<string, ITestStats>) {
  if (!process.env.SLOBS_TEST_RUN_CHUNK) {
    // don't save timings for tests that are not sliced
    return;
  }
  if (fs.existsSync(TEST_STATS_PATH)) {
    // tslint:disable-next-line:no-parameter-reassignment
    stats = { ...JSON.parse(fs.readFileSync(TEST_STATS_PATH, 'utf8')), ...stats };
  }
  fs.writeFileSync(TEST_STATS_PATH, JSON.stringify(stats));
}

// workaround: Ignore the electron.exe processes that are running before the test starts
let ignoreTaskPIDs: number[] = [];
async function getRawElectronTasks() {
  const tasks = await tasklist();
  return tasks.filter(
    (task: any) =>
      task.imageName === 'electron.exe' ||
      task.imageName === 'crash-handler-process.exe' ||
      // obs64.exe holds an open handle on node-obs/logs/*.txt until it exits;
      // without waiting for it, cleanup can hit EBUSY on Windows.
      task.imageName === 'obs64.exe',
  );
}

export async function initializeTasks() {
  const tasks = await getRawElectronTasks();
  ignoreTaskPIDs = tasks.map((task: any) => task.pid);
}

async function getElectronInstances() {
  const tasks = await getRawElectronTasks();
  return tasks.filter((task: any) => !ignoreTaskPIDs.includes(task.pid));
}

export async function killElectronInstances() {
  const tasks = await getElectronInstances();
  tasks.forEach((task: any) => kill(task.pid));
}

// Processes that keep an open handle on files under the cache dir (e.g.
// node-obs/logs/*.txt, crash-handler.log) until they exit. Cleanup must wait
// for these to fully exit, or fs.rmSync can fail with EBUSY on Windows.
const LOCK_HOLDING_IMAGE_NAMES = ['crash-handler-process.exe', 'obs64.exe'];

function isLockHoldingTask(task: any) {
  return LOCK_HOLDING_IMAGE_NAMES.includes(task.imageName) && !ignoreTaskPIDs.includes(task.pid);
}

export async function waitForLogFileHandlesReleased() {
  const interval = 100;
  const timeout = 5000;

  let timeLeft = timeout;

  do {
    const tasks = await tasklist();
    const lockHoldingTasks = tasks.filter(isLockHoldingTask);

    if (lockHoldingTasks.length === 0) {
      return;
    }

    await sleep(interval);
    timeLeft -= interval;
  } while (timeLeft > 0);

  console.warn(`Warning: ${LOCK_HOLDING_IMAGE_NAMES.join('/')} still running after ${timeout}ms timeout`);
}

export async function waitForElectronInstancesExist() {
  const interval = 1000;
  const timeout = 10000;

  let timeLeft = timeout;
  let tasks: any[] = [];

  do {
    tasks = await getElectronInstances();
    if (tasks.length > 0) {
      await sleep(interval);
      timeLeft -= interval;
    }
  } while (tasks.length > 0 && timeLeft > 0);

  if (tasks.length > 0) {
    console.warn(
      `Warning: ${tasks.length} electron instances still running after ${timeout}ms timeout`,
    );
  }
}
