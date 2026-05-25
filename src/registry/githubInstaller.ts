import type { BuiltInServerMetadata } from "./builtins.js";
import type { InstalledCommand } from "./installer.js";

export interface GitHubInstallOptions {
  installDir: string;
}

export async function installGitHubServer(
  metadata: BuiltInServerMetadata,
  _options: GitHubInstallOptions,
): Promise<InstalledCommand> {
  throw new Error(`GitHub installation is not implemented for ${metadata.id}`);
}
