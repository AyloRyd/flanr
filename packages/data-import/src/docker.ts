import { execFile } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Runs a command-line tool from docker-compose.yml. The tool services mount ./data as /data,
 * so every file a tool reads or writes must be inside the data directory.
 */
export async function runTool(repoRoot: string, service: string, args: string[]): Promise<string> {
  // Run as the current user so the output files are not owned by root.
  const user = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  const { stdout } = await run(
    'docker',
    ['compose', 'run', '--rm', '-T', '--user', user, service, ...args],
    { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

/** Path of a file as the tool container sees it, relative to its /data working directory. */
export function pathInDataDir(repoRoot: string, path: string): string {
  const dataDir = resolve(repoRoot, 'data');
  const inside = relative(dataDir, resolve(path));
  if (inside.startsWith('..')) {
    throw new Error(`${path} must be inside ${dataDir}`);
  }
  return inside;
}
