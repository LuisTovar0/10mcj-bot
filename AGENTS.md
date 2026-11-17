# Guidelines

- If any of the commands in the guidelines/instructions do not work, tell me what needs fixing.
- Figure out if you're running on Windows, Linux or WSL. If you're running in WSL and need to use a command tool like `uv`,
  `ov`, `pnpm`, `gh`, `fly`, `supabase`, etc. (basically all programming tools), wrap commands in
  `powershell.exe -Command "..."`.
- **Conventional Commits:** You MUST write all git commit messages conforming to Conventional Commits (e.g.,
  `feat: ...`, `fix: ...`, `docs: ...`).
  for allowed types.
    - Only commit/push if explicitly allowed.
    - Do not join unrelated changes in one commit - try to make them atomic.
    - If you create a branch, never prefix the name with "codex/". Ask the human what should be the name.
- Use WebStorm MCP (if it fails, move on without trying to fix it). Most importantly:
    - Before committing, use the reformat_file tool on the uncommitted files. It is the formatter of record; do NOT use
      `ruff format`. The shared style is the repo-root [`.editorconfig`](./.editorconfig). WebStorm's import sorting is
      canonical too: ruff's isort (`I`) is not in `select` in `backend/pyproject.toml`, so imports may reorder on
      reformat — don't fight it. Formatting is **progressive**: only run `reformat_file` on files you actually changed.
      Never reformat untouched files: legacy formatting is absorbed gradually as files get real changes. Known and
      deferred: line endings are mixed LF/CRLF repo-wide despite `eol=lf`, so `reformat_file` can flip invisible
      EOL-only lines.
    - After edits, use get_file_problems. You don't have to fix every problem it finds, but it should help you find code
      smells.
    - Use get_symbol_info for language documentation.
    - Use rename_refactoring **WHENEVER** you want to move or rename a folder, file, function, variable, etc.
- If you need to create a temporary file/folder, create it in the current directory; **not** in C:\Temp\ or /tmp/.
- Always use `pnpm` for the JS. **`npm` is strictly prohibited.**
- Always use `uv` package manager for the backend.
- **No Package Manager Ingestion:**
    - In `web/`, do NOT run or generate an `npm` lockfile (`package-lock.json`). Use only `pnpm-lock.yaml`.
    - In `backend/`, do NOT use standard `pip` packages unless specified; always use `uv` and lock versions.
- Use **fly CLI** for managing deployments and reading deployment logs. Always prepend `fly`/`flyctl` commands with `FLY_CONFIG_DIR="$HOME/.fly-account3" ` so that the correct account is used.
- **Code**:
    - Try to reuse code if it's repeated more than 2 times.
- **Secrets Protection:** Never read environment files directly nor check in real API keys, Supabase JWT secrets, or AWS
  KMS credentials. Use Fly secrets or local `.env` setups. You may change env files using find & replace commands, but
  never read them.
- Pipegrind (verb): To wait for all running pipelines to finish, and if any are red, then figure out why they failed,
  implement and push a fix, and repeat the process until all pipelines are green.
