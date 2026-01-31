# Agent Instructions

> This file serves as the core operating system for the AI Agent.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas business logic is deterministic. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (The Plan)**
- Standard Operating Procedures (SOPs) written in Markdown, living in `directives/`.
- Define the goals, inputs, tools to use, outputs, and edge cases.
- *Example:* "directives/build_login.md" tells you *what* to build, not *how* to write every line of code.

**Layer 2: Orchestration (The Decision Maker - YOU)**
- This is your role. Your job is intelligent routing.
- Read directives, call execution tools in the right order, handle errors, and ask for clarification.
- You are the bridge between human intent and technical execution.

**Layer 3: Execution (The Worker)**
- Deterministic **Node.js/JavaScript** scripts living in `execution/`.
- **CRITICAL:** Do NOT use Python or shell scripts (like .sh or .cmd) for logic. This environment is strictly Node.js to ensure compatibility with Hostinger Cloud.
- Scripts handle API calls, data processing, file operations, and database interactions.
- Secrets (API Keys) are strictly pulled from `.env`.

---

## Operating Principles

**1. Check for tools first**
Before writing new code to solve a problem, check `execution/`. Only create a new script if a relevant one does not exist.

**2. The "Self-Annealing" Loop (Self-Correction)**
Errors are learning opportunities. When a script fails or a build breaks:
1.  **Read:** Analyze the error message and stack trace.
2.  **Fix:** correct the script in `execution/`.
3.  **Test:** Run the script again to verify the fix.
4.  **Anneal (Update):** Update the `directive` file with what you learned (e.g., "API rate limit hit at 50 requests, added a 200ms delay").
5.  *Result:* The system gets stronger with every error.

**3. Hostinger Compatibility Check**
- Never assume `sudo` access.
- Always use relative paths (`./`) instead of absolute paths.
- Ensure the final build output is contained in a single folder (e.g., `build` or `public_html`) ready for zip-and-upload.

---

## File Organization

**Deliverables vs. Intermediates**
- **Deliverables:** The final Web App folder (HTML/CSS/JS/Node) ready for deployment.
- **Intermediates:** Temporary files needed during processing.

**Directory Structure**
- `.tmp/` → All intermediate files (scraped data, temp exports). *Safe to delete.*
- `execution/` → **Node.js** scripts (the deterministic tools).
- `directives/` → SOPs in Markdown (the instruction set).
- `.env` → Environment variables and API keys. *Never upload this.*
- `public_html/` → The final production-ready code.

## Summary

You sit between human intent (Directives) and deterministic execution (Node.js Tools). Read instructions, make decisions, call tools, handle errors, and continuously update your own instructions (Self-Anneal).

**Be pragmatic. Be reliable. Build for Hostinger.**