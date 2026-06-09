# Releasing anza

## Automated release via CI (recommended)

1. Bump the version in `library/package.json` and update `library/CHANGELOG.md`.
2. Commit and push to `main`.
3. Create a git tag matching the version:

   ```bash
   git tag v0.2.1
   git push origin v0.2.1
   ```

4. The [Release workflow](workflows/release.yml) builds the Rust CLI for all platforms, stages every binary, publishes `@adukiorg/anza` to npm, and creates a GitHub release with binaries attached.

### Requirements

- Add an `NPM_TOKEN` secret to the repository settings (Settings > Secrets and variables > Actions).

### Platform matrix

| OS      | Architecture | Runner         | Method |
|---------|--------------|----------------|--------|
| Linux   | x64          | ubuntu-latest  | Native |
| Linux   | arm64        | ubuntu-latest  | Cross  |
| macOS   | x64          | macos-13       | Native |
| macOS   | arm64        | macos-14       | Native |
| Windows | x64          | windows-latest | Native |
| Windows | arm64        | windows-latest | Cross  |

## Local release (fallback)

```bash
node tasks/publish.js
```

This builds the Rust binary locally (host platform only) and publishes from `library/`.
