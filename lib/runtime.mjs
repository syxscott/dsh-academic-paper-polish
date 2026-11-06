// The panel-activity beacon: a tiny, dependency-free activity log.
//
// The panel (client half) cannot be driven from a script — the authenticated
// page is off limits for automated verification. What it CAN do is report what
// it is doing; this module persists that report to a file the developer can
// read from disk.
//
// Rules:
//   · telemetry must never break the panel — every failure is a warning and
//     a `false`, never an exception;
//   · the file must never be half written — the write goes to a `.tmp` file
//     that is renamed over the target, so a crash leaves the previous file
//     intact;
//   · the directory is resolved from the environment on EVERY call, so a test
//     can point the writer somewhere else without reloading the module.

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The plugin id — also the directory name inside the profile runtime folder. */
export const PLUGIN_ID = 'dsh-academic-paper-polish';

/** The file the activity is written to. */
export const ACTIVITY_FILE = 'panel-activity.json';

/** How many entries are kept. Older ones fall off the front. */
export const MAX_ENTRIES = 50;

/** Caps for the error payload of one entry. */
const MAX_MESSAGE = 500;
const MAX_STACK = 2000;

/** The plugin directory — the parent of `lib/`. */
const PLUGIN_DIR = fileURLToPath(new URL('../', import.meta.url));

/**
 * The directory the activity file lives in. First match wins:
 *   1. `DSH_ACADEMIC_PAPER_RUNTIME_DIR` — the test override, beats everything
 *   2. `DSH_PROFILE_DIR` → `<profile>/.plugin-runtime/dsh-academic-paper-polish/`
 *   3. the plugin directory → `<plugin>/.runtime/`
 */
export function runtimeDir() {
  const override = process.env.DSH_ACADEMIC_PAPER_RUNTIME_DIR;
  if (typeof override === 'string' && override.trim()) return resolve(override.trim());
  const profile = process.env.DSH_PROFILE_DIR;
  if (typeof profile === 'string' && profile.trim()) {
    return join(resolve(profile.trim()), '.plugin-runtime', PLUGIN_ID);
  }
  return join(PLUGIN_DIR, '.runtime');
}

/** The absolute path of the activity file. */
export function activityFile() {
  return join(runtimeDir(), ACTIVITY_FILE);
}

/** Build one entry: `at` plus the fields that were actually supplied. */
function normaliseEntry(input) {
  const source = input && typeof input === 'object' ? input : {};
  const entry = { at: new Date().toISOString() };

  if (typeof source.sessionId === 'string' && source.sessionId.trim()) {
    entry.sessionId = source.sessionId.trim();
  }
  if (typeof source.view === 'string' && source.view.trim()) {
    entry.view = source.view.trim();
  }
  if (typeof source.event === 'string' && source.event.trim()) {
    entry.event = source.event.trim();
  }
  if (source.width !== undefined && source.width !== null) {
    const width = typeof source.width === 'number' ? source.width : Number(source.width);
    if (Number.isFinite(width)) entry.width = width;
  }
  if (source.error && typeof source.error === 'object') {
    const message = typeof source.error.message === 'string' ? source.error.message : '';
    const stack = typeof source.error.stack === 'string' ? source.error.stack : '';
    entry.error = {
      message: message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE - 1)}…` : message,
    };
    if (stack) {
      entry.error.stack = stack.length > MAX_STACK ? `${stack.slice(0, MAX_STACK - 1)}…` : stack;
    }
  }
  return entry;
}

/**
 * Read the recorded activity. A missing or corrupt file is an empty log —
 * this never throws.
 */
export function readActivity() {
  try {
    const raw = readFileSync(activityFile(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === 'object')
      .slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Append one entry and keep the last {@link MAX_ENTRIES}.
 * @returns {number|false} how many entries are stored now, or false on failure
 */
export function appendActivity(input) {
  const target = activityFile();
  const temporary = `${target}.tmp`;
  try {
    mkdirSync(runtimeDir(), { recursive: true });
    const entries = readActivity();
    entries.push(normaliseEntry(input));
    const kept = entries.slice(-MAX_ENTRIES);
    // Atomic: the temporary file is renamed over the target, so a crash in
    // the middle can never leave a half-written log behind.
    writeFileSync(temporary, `${JSON.stringify(kept, null, 2)}\n`, 'utf8');
    renameSync(temporary, target);
    return kept.length;
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      /* nothing to clean up */
    }
    console.warn(
      `[${PLUGIN_ID}] panel-activity 写入失败：${error?.message ?? error}`,
    );
    return false;
  }
}
