# Template repository setup

After the repository is created on GitHub:

1. Keep it public.
2. Enable **Template repository** in repository settings.
3. Keep the default branch named `main`.
4. Enable branch protection if desired.
5. Do not add repository secrets for the normal build; CI requires none.
6. Confirm the CI workflow builds the ZIP and checksum.
7. Replace the example module metadata before publishing a module release.

The initial source archive is intentionally usable without GitHub-specific settings. The template flag only adds the **Use this template** button.
