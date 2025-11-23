#!/usr/bin/env bun

import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const API_URL = 'https://net-secondary.web.minecraft-services.net/api/v1.0/download/links';

interface DownloadLink {
  downloadType: string;
  downloadUrl: string;
}

interface APIResponse {
  result: {
    links: DownloadLink[];
  };
}

interface VersionInfo {
  version: string;
  windows: string;
  linux: string;
  releasedAt: string;
}

interface HistoryEntry {
  type: 'stable' | 'preview';
  version: string;
  windows: string;
  linux: string;
  releasedAt: string;
}

interface VersionData {
  latest: {
    stable: VersionInfo;
    preview: VersionInfo;
  };
  history: HistoryEntry[];
}

function extractVersion(url: string): string | null {
  const match = url.match(/bedrock-server-(\d+\.\d+(?:\.\d+){1,2})\.zip/);
  return match ? match[1] : null;
}

async function fetchLatestVersions(): Promise<{ stable: VersionInfo; preview: VersionInfo }> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch versions: ${response.statusText}`);
  }

  const data: APIResponse = await response.json();
  const links = data.result.links;

  const stableWindows = links.find(link => link.downloadType === 'serverBedrockWindows')?.downloadUrl || '';
  const stableLinux = links.find(link => link.downloadType === 'serverBedrockLinux')?.downloadUrl || '';
  const previewWindows = links.find(link => link.downloadType === 'serverBedrockPreviewWindows')?.downloadUrl || '';
  const previewLinux = links.find(link => link.downloadType === 'serverBedrockPreviewLinux')?.downloadUrl || '';

  const stableVersion = extractVersion(stableWindows) || extractVersion(stableLinux) || 'unknown';
  const previewVersion = extractVersion(previewWindows) || extractVersion(previewLinux) || 'unknown';

  const now = new Date().toISOString();

  return {
    stable: {
      version: stableVersion,
      windows: stableWindows,
      linux: stableLinux,
      releasedAt: now,
    },
    preview: {
      version: previewVersion,
      windows: previewWindows,
      linux: previewLinux,
      releasedAt: now,
    },
  };
}

async function loadExistingData(filePath: string): Promise<VersionData | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to read existing versions file: ${error}`);
    return null;
  }
}

function setOutput(name: string, value: string): void {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const outputLine = `${name}=${value}\n`;
    Bun.write(githubOutput, outputLine, { createPath: true });
  }
  console.log(`::set-output name=${name}::${value}`);
}

async function main() {
  const outputFile = process.argv[2] || 'versions.json';
  const outputPath = join(process.cwd(), outputFile);

  console.log('Fetching Minecraft Bedrock versions from official API...');
  const latestVersions = await fetchLatestVersions();

  console.log(`Stable version: ${latestVersions.stable.version}`);
  console.log(`Preview version: ${latestVersions.preview.version}`);

  const existingData = await loadExistingData(outputPath);

  let hasChanges = false;
  let newHistory: HistoryEntry[] = existingData?.history || [];

  if (!existingData) {
    console.log('No existing versions file found. Creating new one...');
    hasChanges = true;
  } else {
    const stableChanged = existingData.latest.stable.version !== latestVersions.stable.version;
    const previewChanged = existingData.latest.preview.version !== latestVersions.preview.version;

    if (stableChanged) {
      console.log(`Stable version changed: ${existingData.latest.stable.version} -> ${latestVersions.stable.version}`);
      // Add old stable version to history
      newHistory.push({
        type: 'stable',
        version: existingData.latest.stable.version,
        windows: existingData.latest.stable.windows,
        linux: existingData.latest.stable.linux,
        releasedAt: existingData.latest.stable.releasedAt,
      });
      hasChanges = true;
    } else {
      // Preserve existing releasedAt timestamp if no change
      latestVersions.stable.releasedAt = existingData.latest.stable.releasedAt;
    }

    if (previewChanged) {
      console.log(`Preview version changed: ${existingData.latest.preview.version} -> ${latestVersions.preview.version}`);
      // Add old preview version to history
      newHistory.push({
        type: 'preview',
        version: existingData.latest.preview.version,
        windows: existingData.latest.preview.windows,
        linux: existingData.latest.preview.linux,
        releasedAt: existingData.latest.preview.releasedAt,
      });
      hasChanges = true;
    } else {
      // Preserve existing releasedAt timestamp if no change
      latestVersions.preview.releasedAt = existingData.latest.preview.releasedAt;
    }

    if (!hasChanges) {
      console.log('No version changes detected.');
    }
  }

  // Remove duplicates from history (by type + version)
  const uniqueHistory = newHistory.filter((entry, index, self) =>
    index === self.findIndex((e) => e.type === entry.type && e.version === entry.version)
  );

  // Sort history by releasedAt (newest first)
  uniqueHistory.sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime());

  const versionData: VersionData = {
    latest: latestVersions,
    history: uniqueHistory,
  };

  // Write versions file
  await writeFile(outputPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`Versions written to ${outputPath}`);

  // Set GitHub Actions outputs
  setOutput('updated', hasChanges ? 'true' : 'false');
  setOutput('stable-version', latestVersions.stable.version);
  setOutput('preview-version', latestVersions.preview.version);
  setOutput('has-changes', hasChanges ? 'true' : 'false');

  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
