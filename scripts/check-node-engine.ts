import { readFile } from "node:fs/promises";
import path from "node:path";

function parseMajorFromVersion(version: string): number | null {
  const match = version.match(/\d+/);
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[0], 10);
  return Number.isNaN(major) ? null : major;
}

function parseRequiredMajor(range: string): number | null {
  const match = range.match(/\d+/);
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[0], 10);
  return Number.isNaN(major) ? null : major;
}

async function main() {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as {
    engines?: { node?: string };
  };

  const requiredRange = parsed.engines?.node;
  if (!requiredRange) {
    console.log("[engine-check] No engines.node configured. Continuing migration.");
    return;
  }

  const currentVersion = process.version;
  const currentMajor = parseMajorFromVersion(currentVersion);
  const requiredMajor = parseRequiredMajor(requiredRange);

  if (!currentMajor || !requiredMajor) {
    console.log(
      `[engine-check] Could not parse Node versions (current=${currentVersion}, required=${requiredRange}). Continuing migration.`,
    );
    return;
  }

  if (currentMajor !== requiredMajor) {
    console.warn(
      `[engine-check] WARNING: package expects Node ${requiredRange} but current runtime is ${currentVersion}. Continuing migration in compatibility mode.`,
    );
    console.warn(
      "[engine-check] Recommendation: switch to Node 22.x to avoid subtle tooling differences.",
    );
    return;
  }

  console.log(
    `[engine-check] Node runtime OK (${currentVersion}) for expected engine ${requiredRange}.`,
  );
}

void main();
