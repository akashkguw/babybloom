"""
BabyBloom — Formal proof of LWW sync merge correctness.

Built for UW CSEP 590B (CARS: Computer-Aided Reasoning for Software).
This script uses Z3 to PROVE — not just test — that the pointwise merge
rule used by src/lib/sync/merge.ts satisfies the algebraic properties
that make multi-device sync safe under arbitrary packet ordering:

    1. Idempotence:    merge(e, e) = e
    2. Commutativity:  merge(a, b) = merge(b, a)       — modulo a known caveat
    3. Associativity:  merge(merge(a, b), c) = merge(a, merge(b, c))
    4. Tombstone monotonicity: a delete can never be resurrected by merging
       with an older non-deleted version.

The current implementation fails FULL commutativity in one narrow case:
two tombstones with the same modified_at but different deleted_at.  The
script proves the weaker form (commutativity-with-precondition) for the
current code, and also proves that a TWO-LINE STRENGTHENING of the merge
rule ("take max(deleted_at) on tombstone tie") is fully commutative.
That gives the maintainer a concrete, verified fix.

MODEL
─────
An entry is (modified_at: Int, deleted_at: Int). deleted_at = 0 means
"not deleted"; any positive value is the tombstone timestamp.

The pointwise merge mirrors the logic in mergeLogEntries step 1
(src/lib/sync/merge.ts lines 143-170):

    merge(a, b):
        if a.modified_at > b.modified_at:          return a
        elif b.modified_at > a.modified_at:        return b
        else:                                      # tie on modified_at
            # "Same modified_at but this one has a delete — delete wins"
            if a.deleted_at != 0 and b.deleted_at == 0: return a
            if b.deleted_at != 0 and a.deleted_at == 0: return b
            # full tie — deterministic choice (models stable sort)
            return a

RUNNING
───────
    pip install z3-solver --break-system-packages --only-binary=:all:
    python3 tests/formal/lww_sync_proof.py

All four theorems should report "PROVED".  A reported "COUNTEREXAMPLE"
would mean the real code has a corresponding bug.
"""

from __future__ import annotations

from z3 import (
    Int,
    If,
    And,
    Not,
    Or,
    Solver,
    sat,
    unsat,
    ForAll,
    Implies,
)


# ─── Model: entry = (modified_at, deleted_at) ──────────────────────────────

def merge(a_mod, a_del, b_mod, b_del):
    """
    Pointwise merge of two versions of the same entry id.
    Returns (merged_mod, merged_del) as Z3 expressions.

    Matches src/lib/sync/merge.ts mergeLogEntries step 1:
      - strict LWW by modified_at
      - on tie: delete wins over non-delete
      - on full tie: keep `a` (models stable "first-seen wins")
    """
    # Case A: a strictly newer
    a_wins_time = a_mod > b_mod
    # Case B: b strictly newer
    b_wins_time = b_mod > a_mod
    # Case C: tie, a is a tombstone and b isn't → a wins
    a_wins_tombstone = And(a_mod == b_mod, a_del != 0, b_del == 0)
    # Case D: tie, b is a tombstone and a isn't → b wins
    b_wins_tombstone = And(a_mod == b_mod, b_del != 0, a_del == 0)
    # Else: keep a (deterministic)

    take_a = Or(a_wins_time, a_wins_tombstone)
    take_b = Or(b_wins_time, b_wins_tombstone)

    merged_mod = If(take_b, b_mod, a_mod)
    merged_del = If(take_b, b_del, If(take_a, a_del, a_del))
    return merged_mod, merged_del


def merge_fixed(a_mod, a_del, b_mod, b_del):
    """
    PROPOSED STRENGTHENING of the merge rule: on a modified_at tie where
    BOTH sides are tombstones, take the MAX of the two deleted_at values.
    This restores full commutativity.  Two lines of change in
    src/lib/sync/merge.ts around the existing "delete wins" branch.
    """
    a_wins_time = a_mod > b_mod
    b_wins_time = b_mod > a_mod
    a_wins_tombstone = And(a_mod == b_mod, a_del != 0, b_del == 0)
    b_wins_tombstone = And(a_mod == b_mod, b_del != 0, a_del == 0)
    both_tombstones = And(a_mod == b_mod, a_del != 0, b_del != 0)

    take_a_only = Or(a_wins_time, a_wins_tombstone)
    take_b_only = Or(b_wins_time, b_wins_tombstone)

    merged_mod = If(take_b_only, b_mod, a_mod)
    # On a double-tombstone tie, use max(a_del, b_del) — symmetric.
    tombstone_choice = If(a_del > b_del, a_del, b_del)
    merged_del = If(
        both_tombstones,
        tombstone_choice,
        If(take_b_only, b_del, a_del),
    )
    return merged_mod, merged_del


def eq_entry(a_mod, a_del, b_mod, b_del):
    """Structural equality of two entries."""
    return And(a_mod == b_mod, a_del == b_del)


# ─── Theorem runner ────────────────────────────────────────────────────────

def prove(name: str, claim_not_holds, bindings=None):
    """
    Prove a universally-quantified claim by asking Z3 for a counterexample
    to its negation.  If unsat, the claim is proved.  If sat, Z3 produces
    a concrete falsifying assignment.
    """
    s = Solver()
    s.add(claim_not_holds)
    result = s.check()
    if result == unsat:
        print(f"  [PROVED]        {name}")
        return True
    elif result == sat:
        print(f"  [COUNTEREXAMPLE] {name}")
        m = s.model()
        for decl in m.decls():
            print(f"       {decl.name()} = {m[decl]}")
        return False
    else:
        print(f"  [UNKNOWN]       {name}")
        return False


# ─── Theorems ──────────────────────────────────────────────────────────────

def theorem_idempotence():
    """∀ e. merge(e, e) = e"""
    a_mod, a_del = Int("a_mod"), Int("a_del")
    m_mod, m_del = merge(a_mod, a_del, a_mod, a_del)
    claim = eq_entry(m_mod, m_del, a_mod, a_del)
    # Ask for a counterexample: an entry where merge(a, a) ≠ a.
    return prove("1. Idempotence:   merge(e, e) = e", Not(claim))


def theorem_commutativity():
    """
    ∀ a, b. (NOT (both tombstones with same mod_at but different del_at))
             ⇒ merge(a, b) = merge(b, a)

    The excluded case is when a.mod == b.mod, a.del != 0, b.del != 0,
    and a.del != b.del.  That's the corner Z3 found: both are tombstones
    with identical modified_at but slightly different deleted_at — the
    current rule keeps the first-argument's del timestamp, which is
    order-dependent.  See theorem_commutativity_strengthened for the fix.
    """
    a_mod, a_del = Int("a_mod"), Int("a_del")
    b_mod, b_del = Int("b_mod"), Int("b_del")

    ab_mod, ab_del = merge(a_mod, a_del, b_mod, b_del)
    ba_mod, ba_del = merge(b_mod, b_del, a_mod, a_del)

    bad_corner = And(
        a_mod == b_mod,
        a_del != 0,
        b_del != 0,
        a_del != b_del,
    )
    claim = Implies(Not(bad_corner), eq_entry(ab_mod, ab_del, ba_mod, ba_del))
    return prove("2. Commutativity (current rule, excluding dual-tombstone tie)", Not(claim))


def theorem_commutativity_strengthened():
    """
    Same commutativity claim, but against merge_fixed (which takes
    max(deleted_at) on a dual-tombstone tie).  If this PROVES, the
    maintainer has a verified drop-in replacement for the current rule.
    """
    a_mod, a_del = Int("a_mod"), Int("a_del")
    b_mod, b_del = Int("b_mod"), Int("b_del")

    ab_mod, ab_del = merge_fixed(a_mod, a_del, b_mod, b_del)
    ba_mod, ba_del = merge_fixed(b_mod, b_del, a_mod, a_del)

    claim = eq_entry(ab_mod, ab_del, ba_mod, ba_del)
    return prove("2b. Commutativity (strengthened rule, unconditional)", Not(claim))


def theorem_associativity():
    """∀ a, b, c. merge(merge(a, b), c) = merge(a, merge(b, c))"""
    a_mod, a_del = Int("a_mod"), Int("a_del")
    b_mod, b_del = Int("b_mod"), Int("b_del")
    c_mod, c_del = Int("c_mod"), Int("c_del")

    ab_mod, ab_del = merge(a_mod, a_del, b_mod, b_del)
    left_mod, left_del = merge(ab_mod, ab_del, c_mod, c_del)

    bc_mod, bc_del = merge(b_mod, b_del, c_mod, c_del)
    right_mod, right_del = merge(a_mod, a_del, bc_mod, bc_del)

    claim = eq_entry(left_mod, left_del, right_mod, right_del)
    return prove("3. Associativity: merge(merge(a,b),c) = merge(a,merge(b,c))", Not(claim))


def theorem_tombstone_monotonicity():
    """
    ∀ a, b. a.deleted_at != 0 ∧ b.modified_at ≤ a.modified_at
             ⇒ merge(a, b).deleted_at != 0

    Once a is a tombstone and b is older or contemporaneous, the merged
    result is still a tombstone. This protects against phantom restores.
    """
    a_mod, a_del = Int("a_mod"), Int("a_del")
    b_mod, b_del = Int("b_mod"), Int("b_del")

    m_mod, m_del = merge(a_mod, a_del, b_mod, b_del)

    claim = Implies(
        And(a_del != 0, b_mod <= a_mod),
        m_del != 0,
    )
    return prove("4. Tombstone monotonicity (delete never resurrects)", Not(claim))


# ─── Bonus: show the known identical-millisecond-clash quirk ───────────────

def demo_pre_existing_behavior():
    """
    Document a subtle detail uncovered during property-based testing:
    when two entries arrive with IDENTICAL modified_at and IDENTICAL
    deleted_at == 0 but DIFFERENT content (e.g. type/notes), the merge
    is content-agnostic — it deterministically keeps the first. That
    means at the ARRAY level, mergeLogEntries(A, B) and mergeLogEntries(B, A)
    can select different content on a tie. At the POINTWISE level (this
    proof), that's fine: the function's output depends only on
    (modified_at, deleted_at). We record the caveat here for future
    reference.
    """
    print()
    print("  Note: this proof models entries as (modified_at, deleted_at) only.")
    print("        Array-level merge commutativity additionally requires unique")
    print("        modified_at per id; otherwise payload-content tie-breaking is")
    print("        device-order-dependent. See tests/unit/property.test.ts.")


# ─── Main ──────────────────────────────────────────────────────────────────

def main() -> int:
    print("BabyBloom LWW sync merge — Z3 correctness proof")
    print("=" * 56)
    results = [
        theorem_idempotence(),
        theorem_commutativity(),
        theorem_commutativity_strengthened(),
        theorem_associativity(),
        theorem_tombstone_monotonicity(),
    ]
    demo_pre_existing_behavior()
    print()
    if all(results):
        print(f"  All {len(results)} theorems PROVED.")
        return 0
    print(f"  {sum(1 for r in results if not r)} of {len(results)} FAILED.")
    return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
