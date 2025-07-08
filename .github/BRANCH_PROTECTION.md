# Branch Protection Rules

To ensure code quality and prevent accidental pushes to main branches, configure the following branch protection rules in your GitHub repository settings:

## Main Branch Protection

For the `main` branch, enable:

### Required Status Checks
- ✅ **Require status checks to pass before merging**
  - `lint` - Ruff linting must pass
  - `test-python` - All Python tests must pass
  - `test-javascript` - All JavaScript tests must pass
  - `build` - Docker build must succeed
  - `security-scan` - Security scan must pass

### Pull Request Requirements
- ✅ **Require pull request reviews before merging**
  - Required approving reviews: 1
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from CODEOWNERS (if configured)

### Additional Protection
- ✅ **Require branches to be up to date before merging**
- ✅ **Require conversation resolution before merging**
- ✅ **Include administrators** (recommended for production)
- ✅ **Restrict who can push to matching branches** (optional)

## Develop Branch Protection

For the `develop` branch, enable similar rules but potentially less strict:

- ✅ Required status checks (same as main)
- ✅ Require pull request reviews (can be 0 for faster development)
- ✅ Require branches to be up to date

## Setting Up Branch Protection

1. Go to Settings → Branches in your GitHub repository
2. Click "Add rule"
3. Enter branch name pattern (e.g., `main`)
4. Configure the protection rules as listed above
5. Click "Create" or "Save changes"

## CI/CD Status Badges

Add these badges to your README.md:

```markdown
[![CI](https://github.com/YOUR_USERNAME/sim_frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/sim_frontend/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/sim_frontend/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/sim_frontend)
```