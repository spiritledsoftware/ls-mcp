import type { spawn } from "node:child_process";

import type { BuiltInServerMetadata } from "./builtins.js";
import type { InstalledCommand } from "./installer.js";

export interface GitHubInstallOptions {
  installDir: string;
  fetchImpl?: typeof fetch;
  runCommand?: typeof spawn;
}

export async function installGitHubServer(
  metadata: BuiltInServerMetadata,
  options: GitHubInstallOptions,
): Promise<InstalledCommand> {
  void options;
  if (metadata.installStrategy.type !== "github") {
    throw new Error(`${metadata.id} does not use GitHub install strategy`);
  }
  throw new Error("GitHub archive installation is not supported yet");
}
