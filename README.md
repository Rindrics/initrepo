# @rindrics/initrepo

CLI tool for rapid repository setup with CI/CD, code quality tools, and release automation.

## Installation

```bash
npm install -g @rindrics/initrepo
```

## Usage

### Create a new project

```bash
# Create a devcode project (private, can be renamed later)
initrepo init my-super-project --devcode

# Create a release-ready project
initrepo init @scope/my-package
```

### Prepare for release

When ready to publish, convert your devcode project:

```bash
cd my-super-project
initrepo prepare-release @scope/my-package
```

This will:
- Update `package.json` name and remove `private: true`
- Configure workflows for `PAT_FOR_TAGPR`
- Report any unmanaged occurrences of the devcode name for manual review

### Setup for automated releases

1. **Create a PAT** at https://github.com/settings/tokens/new
   - Permissions: `repo` (or `public_repo`), `workflow`
   - Add as repository secret: `PAT_FOR_TAGPR`

2. **Configure npm for GitHub Actions publishing**
   - Go to npmjs.com → Package Settings → Publishing access
   - Add your repository to trusted publishers

## License

MIT
