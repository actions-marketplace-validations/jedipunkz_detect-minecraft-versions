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

interface VersionData {
  stable: {
    version: string;
    windows: string;
    linux: string;
    updatedAt: string;
  };
  preview: {
    version: string;
    windows: string;
    linux: string;
    updatedAt: string;
  };
}

function extractVersion(url: string): string | null {
  const match = url.match(/bedrock-server-(\d+\.\d+(?:\.\d+){1,2})\.zip/);
  return match ? match[1] : null;
}

async function fetchVersions(): Promise<VersionData> {
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
      updatedAt: now,
    },
    preview: {
      version: previewVersion,
      windows: previewWindows,
      linux: previewLinux,
      updatedAt: now,
    },
  };
}

async function loadExistingVersions(filePath: string): Promise<VersionData | null> {
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
  const newVersions = await fetchVersions();

  console.log(`Stable version: ${newVersions.stable.version}`);
  console.log(`Preview version: ${newVersions.preview.version}`);

  const existingVersions = await loadExistingVersions(outputPath);

  let hasChanges = false;
  if (!existingVersions) {
    console.log('No existing versions file found. Creating new one...');
    hasChanges = true;
  } else {
    const stableChanged = existingVersions.stable.version !== newVersions.stable.version;
    const previewChanged = existingVersions.preview.version !== newVersions.preview.version;

    if (stableChanged) {
      console.log(`Stable version changed: ${existingVersions.stable.version} -> ${newVersions.stable.version}`);
      hasChanges = true;
    }
    if (previewChanged) {
      console.log(`Preview version changed: ${existingVersions.preview.version} -> ${newVersions.preview.version}`);
      hasChanges = true;
    }

    if (!hasChanges) {
      console.log('No version changes detected.');
      // Preserve existing updatedAt timestamps if no changes
      newVersions.stable.updatedAt = existingVersions.stable.updatedAt;
      newVersions.preview.updatedAt = existingVersions.preview.updatedAt;
    }
  }

  // Write versions file
  await writeFile(outputPath, JSON.stringify(newVersions, null, 2) + '\n');
  console.log(`Versions written to ${outputPath}`);

  // Set GitHub Actions outputs
  setOutput('updated', hasChanges ? 'true' : 'false');
  setOutput('stable-version', newVersions.stable.version);
  setOutput('preview-version', newVersions.preview.version);
  setOutput('has-changes', hasChanges ? 'true' : 'false');

  if (hasChanges) {
    process.exit(0);
  } else {
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
