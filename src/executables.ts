import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";

const MAC_BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender";

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(name: string): Promise<string | null> {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

export async function resolveExecutable(
  envName: string,
  commandName: string,
  fallbacks: string[] = [],
): Promise<string> {
  const configured = process.env[envName];
  if (configured) {
    if (!(await isExecutable(configured))) {
      throw new Error(`${envName} points to a missing executable.`);
    }
    return configured;
  }

  const onPath = await findOnPath(commandName);
  if (onPath) return onPath;

  for (const candidate of fallbacks) {
    if (await isExecutable(candidate)) return candidate;
  }

  throw new Error(
    `Could not find ${commandName}. Install it or set ${envName} to its executable path.`,
  );
}

export async function resolveBlender(): Promise<string> {
  return await resolveExecutable("BLENDER_BIN", "blender", [MAC_BLENDER]);
}
