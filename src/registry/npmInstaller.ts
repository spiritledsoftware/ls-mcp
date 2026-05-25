import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { BuiltInServerMetadata } from "./builtins.js";
import type { InstalledCommand } from "./installer.js";

export interface NpmInstallOptions {
  installDir: string;
  runCommand?: typeof spawn;
}

export async function installNpmServer(
  metadata: BuiltInServerMetadata,
  options: NpmInstallOptions,
): Promise<InstalledCommand> {
  if (metadata.installStrategy.type !== "npm") {
    throw new Error(`${metadata.id} does not use npm install strategy`);
  }

  await mkdir(options.installDir, { recursive: true });
  const runner = options.runCommand ?? spawn;
  const spec = `${metadata.installStrategy.package}@${metadata.version}`;

  await new Promise<void>((resolve, reject) => {
    const child = runner(
      "npm",
      ["install", "--ignore-scripts", "--prefix", options.installDir, spec],
      {
        stdio: "ignore",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`npm install failed for ${metadata.id} with exit code ${code ?? "unknown"}`),
      );
    });
  });

  const binName = process.platform === "win32" ? `${metadata.command}.cmd` : metadata.command;
  return {
    command: join(options.installDir, "node_modules", ".bin", binName),
    args: metadata.args,
  };
}
