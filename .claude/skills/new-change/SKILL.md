---
name: new-change
description: Start a new OpenSpec change — creates the git feature branch and generates all artifacts in one step. Use when the user wants to begin working on a new change in the sequence.
license: MIT
compatibility: Requires openspec CLI and git.
metadata:
  author: employeek
  version: "1.0"
---

Start a new OpenSpec change: create the feature branch and scaffold all artifacts (proposal, design, specs, tasks) ready for implementation.

**Input**: Argument after `/new-change` is the change name in kebab-case (e.g., `setup-ci-github-actions`), OR a description of what to build.

---

## Steps

### 1. Resolve the change name

If no argument was provided, use **AskUserQuestion** (open-ended) to ask:
> "¿Cómo se llamará este change? Descríbelo o dame un nombre en kebab-case."

From a description, derive a kebab-case name (e.g., "agregar CI con GitHub Actions" → `setup-ci-github-actions`).

**Do NOT proceed without a name.**

### 2. Determine the next CH number

Count total changes (archived + in-flight) to assign the next sequential number:

```bash
# Archived changes (each dated subdirectory = one archived change)
ls openspec/changes/archive/ | wc -l
# In-flight changes (non-archive subdirectories in openspec/changes/)
ls -d openspec/changes/*/ | grep -v archive | wc -l
```

`CH_NUMBER = archived_count + in_flight_count + 1`

The branch name will be `ch<CH_NUMBER>/<change-name>` (e.g., `ch7/setup-ci-github-actions`).

### 3. Verify git state is clean

```bash
git status --porcelain
git branch --show-current
```

- If working tree is dirty, warn the user and stop — ask them to commit or stash first.
- If not on `main`, warn but continue (user may be intentional).

### 4. Pull latest main

```bash
git checkout main
git pull --ff-only
```

If `pull --ff-only` fails (diverged), stop and explain: the user needs to reconcile manually.

### 5. Create the feature branch

```bash
git checkout -b ch<CH_NUMBER>/<change-name>
```

Show the user: "Branch `ch<CH_NUMBER>/<change-name>` created."

### 6. Scaffold the OpenSpec change

```bash
openspec new change "<change-name>"
```

This creates `openspec/changes/<change-name>/` with `.openspec.yaml`.

### 7. Generate all artifacts

Follow the same artifact loop as `/opsx:propose`:

a. Get artifact build order:
```bash
openspec status --change "<change-name>" --json
```

b. For each artifact in dependency order (`ready` status first):
```bash
openspec instructions <artifact-id> --change "<change-name>" --json
```
- Read `dependencies` files for context.
- Write the artifact to `outputPath` using `template` as structure.
- Apply `context` and `rules` as constraints — **never copy them into the file**.
- Show brief progress: "Created `<artifact-id>`"

c. Continue until every artifact in `applyRequires` has `status: "done"`.

d. If input is needed, use **AskUserQuestion** — then continue.

### 8. Commit scaffolded artifacts

```bash
git add openspec/changes/<change-name>/
git commit -m "chore(openspec): add <change-name> change artifacts"
```

### 9. Final status

```bash
openspec status --change "<change-name>"
git log --oneline -3
```

---

## Output

Summarize:
- Branch name and CH number
- Artifacts created (bullet list)
- Next step: "Run `/opsx:apply` to start implementing."

---

## Guardrails

- Never modify `openspec/changes/archive/`.
- If the change name already exists in `openspec/changes/`, ask the user: continue it or pick a new name?
- Keep artifact content consistent with what's in `CLAUDE.md` (stack, conventions, patterns).
- Follow Conventional Commits for the scaffold commit — do not skip the commit-msg hook.
