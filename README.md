# Detect Minecraft Bedrock Versions

GitHub Action to automatically detect and track Minecraft Bedrock Edition versions (stable and preview) using the official Microsoft API.

## Features

- Fetches version information directly from Microsoft's official API
- Tracks both **stable** and **preview** versions
- Updates `versions.json` automatically when new versions are released
- Zero dependencies (uses Bun runtime)
- Fast and efficient

## Usage

### As a GitHub Action

Create a workflow file (e.g., `.github/workflows/update-versions.yml`):

```yaml
name: Update Minecraft Bedrock Versions

on:
  schedule:
    # Run every hour
    - cron: '0 * * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update-versions:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Detect Minecraft Bedrock versions
        id: detect
        uses: your-username/detect-minecraft-versions@v1
        with:
          output-file: 'versions.json'

      - name: Commit and push changes
        if: steps.detect.outputs.has-changes == 'true'
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add versions.json
          git commit -m "Update Minecraft Bedrock versions"
          git push
```

### Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `output-file` | Path to the output JSON file | No | `versions.json` |

### Outputs

| Name | Description |
|------|-------------|
| `updated` | Whether versions were updated (`true`/`false`) |
| `stable-version` | Latest stable version (e.g., `1.21.124.2`) |
| `preview-version` | Latest preview version (e.g., `1.21.130.28`) |
| `has-changes` | Whether there are changes to commit (`true`/`false`) |

## versions.json Format

The action generates a `versions.json` file with the following structure:

```json
{
  "stable": {
    "version": "1.21.124.2",
    "windows": "https://minecraft.azureedge.net/bin-win/bedrock-server-1.21.124.2.zip",
    "linux": "https://minecraft.azureedge.net/bin-linux/bedrock-server-1.21.124.2.zip",
    "updatedAt": "2025-01-23T12:00:00.000Z"
  },
  "preview": {
    "version": "1.21.130.28",
    "windows": "https://minecraft.azureedge.net/bin-win-preview/bedrock-server-1.21.130.28.zip",
    "linux": "https://minecraft.azureedge.net/bin-linux-preview/bedrock-server-1.21.130.28.zip",
    "updatedAt": "2025-01-23T12:00:00.000Z"
  }
}
```

## Local Development

### Prerequisites

- [Bun](https://bun.sh) installed

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/detect-minecraft-versions.git
cd detect-minecraft-versions

# Install dependencies
bun install

# Run the script
bun run src/index.ts
```

### Testing

```bash
# Run with custom output file
bun run src/index.ts custom-versions.json
```

## How It Works

1. Fetches version information from Microsoft's official API endpoint:
   ```
   https://net-secondary.web.minecraft-services.net/api/v1.0/download/links
   ```

2. Extracts version numbers from download URLs for both stable and preview builds

3. Compares with existing `versions.json` file

4. Updates the file only if versions have changed

5. Outputs results for use in GitHub Actions workflows

## API Source

This action uses the official Microsoft Minecraft Services API, which is the same source used by the Bedrock Dedicated Server download page. This ensures:

- **Official data**: Direct from Microsoft/Mojang
- **Fast updates**: Version information is available immediately upon release
- **Reliability**: No web scraping or unofficial sources

## Example Workflows

### Basic Auto-Update

```yaml
name: Auto-Update Versions

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-username/detect-minecraft-versions@v1
      - run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          git add versions.json
          git diff --staged --quiet || git commit -m "chore: update versions"
          git push
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
