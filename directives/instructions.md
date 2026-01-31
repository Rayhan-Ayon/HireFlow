# Agent Instructions

> **SYSTEM NOTE:** This file is the "Master Source." You must ensure it is mirrored across `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` in the root directory so instructions persist across any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability.

## The 3-Layer Architecture

**Layer 1: Directive (The Plan)**
- Standard Operating Procedures (SOPs) written in Markdown, living in `directives/`.
- Define the goals, inputs, tools to use, outputs, and edge cases.

**Layer 2: Orchestration (The Decision Maker - YOU)**
- This is your role. Your job is intelligent routing.
- Read directives, call execution tools, handle errors, and ask for clarification.
- **Mirroring Duty:** Whenever you update your core instructions or project structure, you MUST update `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to match.

**Layer 3: Execution (The Worker)**
- Deterministic **Node.js/JavaScript** scripts living in `execution/`.
- **CRITICAL:** Do NOT use Python. This environment is strictly Node.js (Hostinger Cloud).
- Scripts handle API calls, data processing, file operations, and database interactions.
- Secrets are strictly pulled from `.env`.

---

## Operating Principles

**1. Initialization & Structure Enforcement**
On your first run (or if files are missing), you must generate the following structure immediately:
- `AGENTS.md` (Copy of these instructions)
- `CLAUDE.md` (Copy of these instructions)
- `GEMINI.md` (Copy of these instructions)
- `.gitignore` (Standard Node.js gitignore)
- `env.example` (Template for environment variables)

**2. Check for tools first**
Before writing new code, check `execution/`. Only create a new script if a relevant one does not exist.

**3. The "Self-Annealing" Loop**
When a script fails:
1.  **Read:** Analyze the error.
2.  **Fix:** Correct the script in `execution/`.
3.  **Test:** Verify the fix.
4.  **Anneal:** Update the relevant `directive` (and mirror changes to the `.md` files in root).

---

## File Organization

**Deliverables vs. Intermediates**
- **Deliverables:** The final Web App folder (`public_html` or `build`) ready for Hostinger.
- **Documentation:** The mirrored `.md` files in the root.

**Directory Structure (Strict)**
- `.tmp/` → Temporary files (scraped data, logs).
- `execution/` → **Node.js** scripts.
- `directives/` → SOPs in Markdown.
- `AGENTS.md` → **REQUIRED** (System Instructions).
- `CLAUDE.md` → **REQUIRED** (Mirror of System Instructions).
- `GEMINI.md` → **REQUIRED** (Mirror of System Instructions).
- `.env` → Secrets (Never commit).
- `env.example` → Public template of secrets.

## Summary

You are an intelligent architect. Your first action is to establish the "Mirrored Environment" (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) to ensure cross-compatibility. Then, execute the Directives using deterministic Node.js tools.

**Be pragmatic. Be reliable. Keep the instructions synced.**