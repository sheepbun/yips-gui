import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

const REPO_PATH_ENV_KEYS = ["YIPS_T3CODE_REPO_PATH", "T3CODE_REPO_PATH"] as const;
const UPSTREAM_REF_ENV_KEYS = ["YIPS_T3CODE_UPSTREAM_REF", "T3CODE_UPSTREAM_REF"] as const;
const KNOWN_T3CODE_REMOTE_PATTERNS = [
  "github.com/pingdotgg/t3code",
  "git@github.com:pingdotgg/t3code",
] as const;
const KNOWN_UPSTREAM_REF_CANDIDATES = [
  "upstream/main",
  "upstream/master",
  "t3code/main",
  "t3code/master",
] as const;

export interface YipsVersionMetadata {
  readonly appVersion: string;
  readonly appVersionLabel: string;
  readonly buildVersion: string;
  readonly source: "t3code-ahead-count" | "fallback-package-version";
  readonly aheadCount: number | null;
  readonly comparisonTarget: string | null;
}

function runGit(repoRoot: string, args: string[]): string | null {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }

  const stdout = result.stdout.trim();
  return stdout.length > 0 ? stdout : null;
}

function gitRefExists(repoRoot: string, ref: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}

function normalizeLabel(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function resolveRepoTopLevel(repoPath: string): string | null {
  return runGit(repoPath, ["rev-parse", "--show-toplevel"]);
}

function gitCommitExists(repoRoot: string, commit: string): boolean {
  const result = spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}

function parseRemoteUrls(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^remote\.([^.]+)\.url\s+(.+)$/.exec(line);
      if (!match?.[1] || !match[2]) {
        return null;
      }

      return `${match[1]}\t${match[2]}`;
    })
    .filter((value): value is string => value !== null);
}

function resolveConfiguredT3CodeRepoPath(repoRoot: string): string | null {
  const candidatePaths = [
    ...REPO_PATH_ENV_KEYS.map((key) => process.env[key]?.trim() ?? ""),
    resolvePath(repoRoot, "..", "t3code"),
  ];

  for (const candidate of candidatePaths) {
    if (!candidate || !existsSync(candidate)) {
      continue;
    }

    const resolved = resolveRepoTopLevel(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function resolveConfiguredUpstreamRef(repoRoot: string): string | null {
  for (const envKey of UPSTREAM_REF_ENV_KEYS) {
    const candidate = process.env[envKey]?.trim();
    if (candidate && gitRefExists(repoRoot, candidate)) {
      return candidate;
    }
  }

  const remoteConfig = runGit(repoRoot, ["config", "--get-regexp", "^remote\\..*\\.url$"]);
  if (remoteConfig) {
    const matchingRemote = parseRemoteUrls(remoteConfig)
      .map((entry) => {
        const [remoteName, remoteUrl] = entry.split("\t", 2);
        if (!remoteName || !remoteUrl) {
          return null;
        }
        return { remoteName, remoteUrl };
      })
      .filter((entry): entry is { remoteName: string; remoteUrl: string } => entry !== null)
      .find(({ remoteUrl }) =>
        KNOWN_T3CODE_REMOTE_PATTERNS.some((pattern) => remoteUrl.includes(pattern)),
      );

    if (matchingRemote) {
      const remoteRefCandidates = [
        `${matchingRemote.remoteName}/main`,
        `${matchingRemote.remoteName}/master`,
      ];
      for (const candidate of remoteRefCandidates) {
        if (gitRefExists(repoRoot, candidate)) {
          return candidate;
        }
      }
    }
  }

  for (const candidate of KNOWN_UPSTREAM_REF_CANDIDATES) {
    if (gitRefExists(repoRoot, candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveAheadCount(repoRoot: string, comparisonTarget: string): number | null {
  const output = runGit(repoRoot, ["rev-list", "--count", `${comparisonTarget}..HEAD`]);
  if (!output || !/^\d+$/.test(output)) {
    return null;
  }

  return Number.parseInt(output, 10);
}

function normalizeBuildVersion(aheadCount: number): string {
  return `0.0.${aheadCount}`;
}

export function resolveYipsVersionMetadata(
  repoRoot: string,
  fallbackVersion: string,
): YipsVersionMetadata {
  const localT3CodeRepoPath = resolveConfiguredT3CodeRepoPath(repoRoot);
  if (localT3CodeRepoPath) {
    const localT3CodeHead = runGit(localT3CodeRepoPath, ["rev-parse", "HEAD"]);
    if (localT3CodeHead && gitCommitExists(repoRoot, localT3CodeHead)) {
      const aheadCount = resolveAheadCount(repoRoot, localT3CodeHead);
      if (aheadCount !== null) {
        const appVersion = normalizeBuildVersion(aheadCount);
        return {
          appVersion,
          appVersionLabel: normalizeLabel(appVersion),
          buildVersion: normalizeBuildVersion(aheadCount),
          source: "t3code-ahead-count",
          aheadCount,
          comparisonTarget: localT3CodeRepoPath,
        };
      }
    }
  }

  const upstreamRef = resolveConfiguredUpstreamRef(repoRoot);
  if (upstreamRef) {
    const aheadCount = resolveAheadCount(repoRoot, upstreamRef);
    if (aheadCount !== null) {
      const appVersion = normalizeBuildVersion(aheadCount);
      return {
        appVersion,
        appVersionLabel: normalizeLabel(appVersion),
        buildVersion: normalizeBuildVersion(aheadCount),
        source: "t3code-ahead-count",
        aheadCount,
        comparisonTarget: upstreamRef,
      };
    }
  }

  return {
    appVersion: fallbackVersion,
    appVersionLabel: normalizeLabel(fallbackVersion),
    buildVersion: fallbackVersion,
    source: "fallback-package-version",
    aheadCount: null,
    comparisonTarget: null,
  };
}
