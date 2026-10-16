# Repository-specific agent guidance

## Repository instructions

- At the start of each task, read the repository's `CLAUDE.md` in the same directory as this file.
- Treat the instructions in `CLAUDE.md` as additional repository-specific guidance and follow them together with this file.

## GitHub authentication

- Treat local `gh` CLI authentication and Codex's GitHub connector authentication as separate authentication paths.
- Never infer that GitHub authentication is globally expired from a failure of `gh auth status` alone.
- Prefer the GitHub connector for GitHub operations when it is available.
- Check read and write permissions separately; successful PR/issue reads do not imply permission to post comments or modify metadata.
- When an operation fails, report the exact authentication path and operation that failed. Distinguish CLI authentication failures (`gh`) from connector permission failures (`401`/`403`).
- Ask the user before re-authenticating, changing OAuth/App permissions, or otherwise modifying authentication state.
