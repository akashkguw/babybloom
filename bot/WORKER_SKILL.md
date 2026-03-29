# BabyBloom Worker Skill (DEPRECATED)

> **⚠️ DEPRECATED — DO NOT USE THIS SKILL DIRECTLY.**
>
> This was the original monolithic worker that combined triage + implementation + analysis in a single agent.
> It has been replaced by the **multi-agent pipeline**:
>
> 1. **TRIAGE_SKILL.md** — classifies and routes issues
> 2. **IMPL_SKILL.md** — implements code changes
> 3. **ANALYSIS_SKILL.md** — produces read-only analysis
> 4. **DOCS_SKILL.md** — updates documentation
> 5. **INFRA_SKILL.md** — infrastructure changes (manual only)
>
> **If you are a scheduled task or automated worker:** Read and follow `$REPO_DIR/bot/TRIAGE_SKILL.md` instead.
> The Triage Agent will dispatch to the correct specialist agents.
>
> This file is kept for historical reference only. All new development follows the multi-agent flow.
