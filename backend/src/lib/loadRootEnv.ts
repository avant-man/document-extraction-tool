import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

/**
 * Walk up from startDir (defaults to __dirname) until a .env file is found,
 * then load it with dotenv. CWD-independent — anchors to the compiled file's
 * location on disk so it works regardless of how the process was invoked.
 */
export function loadRootEnv(startDir: string = __dirname): void {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[loadRootEnv] No .env file found walking up from', startDir);
      }
      return;
    }
    dir = parent;
  }
}

loadRootEnv();
