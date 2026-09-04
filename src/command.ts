import { spawn } from "node:child_process";

const OUTPUT_LIMIT = 2 * 1024 * 1024;

export interface CommandResult {
  stderr: string;
  stdout: string;
}

export async function runCommand(
  executable: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-OUTPUT_LIMIT);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-OUTPUT_LIMIT);
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stderr, stdout });
        return;
      }

      const detail = (stderr || stdout).trim();
      reject(
        new Error(
          `${executable} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}${
            detail ? `:\n${detail}` : "."
          }`,
        ),
      );
    });
  });
}
