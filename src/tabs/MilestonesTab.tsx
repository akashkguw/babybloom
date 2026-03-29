import React, { useState, useEffect } from 'react';
import {
  Card as Cd,
  SectionHeader as SH,
  Button as Btn,
  Pill,
  Input,
  Icon as Ic,
  Checkbox as CB,
  Dot,
} from '@/components/shared';
import { today, fmtDate } from '@/lib/utils/date';
import { C } from '@/lib/constants/colors';
import { MILESTONES, TEETH_ORDER } from '@/lib/constants/milestones';
import { toast } from '@/lib/utils/toast';

interface MilestoneItem {
  id: number;
  title: string;
  date: string;
  notes?: string;
}

interface FormFirstData {
  title?: string;
  date?: string;
  notes?: string;
}

interface MilestonesTabProps {
  age: number;
  selMo: number;
  setSelMo: (month: number) => void;
  checked: Record<number, Record<string, boolean>>;
  setChecked: (fn: (prev: Record<number, Record<string, boolean>>) => Record<number, Record<string, boolean>>) => void;
  teeth: Record<number, string | null>;
  setTeeth: (fn: (prev: Record<number, string | null>) => Record<number, string | null>) => void;
  firsts: MilestoneItem[];
  setFirsts: (fn: (prev: MilestoneItem[]) => MilestoneItem[]) => void;
  subNavRef?: React.MutableRefObject<string | null>;
}

const PRESET_MILESTONES = [
  "First Smile",
  "First Laugh",
  "First Roll Over",
  "First Solid Food",
  "First Tooth",
  "First Word",
  "First Steps",
  "First Haircut",
  "First Trip",
  "First Birthday",
];

// Moved outside component to prevent remount on every render (fixes keyboard dismiss bug)
function SecBody({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.cd,
        borderRadius: "0 0 16px 16px",
        border: "1px solid " + C.b,
        borderTop: "none",
        padding: "12px 16px 16px",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

const MilestonesTab: React.FC<MilestonesTabProps> = ({
  age,
  selMo,
  setSelMo,
  checked,
  setChecked,
  teeth,
  setTeeth,
  firsts,
  setFirsts,
  subNavRef,
}) => {
  // Initialize expanded sections
  const initExp: Record<string, boolean> = {};
  if (subNavRef?.current) {
    initExp[subNavRef.current] = true;
  }

  const [expanded, setEx] = useState<Record<string, boolean>>(initExp);
  const [showFirst, setShowFirst] = useState(false);
  const [ff, setFF] = useState<FormFirstData>({});
  const [editFirstId, setEditFirstId] = useState<number | null>(null);

  // Handle scroll to section if coming from navigation
  useEffect(() => {
    if (subNavRef?.current) {
      const tgt = subNavRef.current;
      setEx((p) => ({ ...p, [tgt]: true }));
      subNavRef.current = null;
      setTimeout(() => {
        const el = document.getElementById('ml-' + tgt);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  }, []);

  // Get milestone data
  const months = Object.keys(MILESTONES).map(Number);
  const ms = MILESTONES[selMo];

  // Category definitions
  const cats = [
    { k: "motor" as const, l: "Motor Skills", icon: "activity", c: C.p },
    { k: "cog" as const, l: "Cognitive", icon: "brain", c: C.s },
    { k: "soc" as const, l: "Social & Emotional", icon: "heart", c: C.a },
    { k: "lang" as const, l: "Language", icon: "smile", c: C.w },
  ];

  // Toggle milestone checkbox
  function toggle(cat: string, i: number) {
    setChecked((prev) => {
      const n = { ...prev };
      const md = { ...(n[selMo] || {}) };
      md[cat + "_" + i] = !md[cat + "_" + i];
      n[selMo] = md;
      return n;
    });
  }

  // Toggle tooth eruption
  function toggleTooth(i: number) {
    setTeeth((prev) => {
      const n = { ...prev };
      n[i] = n[i] ? null : today();
      return n;
    });
  }

  // Add new memory/first
  function addFirst() {
    const e: MilestoneItem = {
      id: Date.now(),
      date: today(),
      title: ff.title || "",
      notes: ff.notes,
    };
    setFirsts((p) => [e, ...p]);
    setShowFirst(false);
    setFF({});
    setEditFirstId(null);
    toast("Memory saved!");
  }

  // Update existing memory/first
  function updateFirst() {
    if (!editFirstId) return;
    setFirsts((p) =>
      p.map((f) =>
        f.id === editFirstId
          ? { ...f, title: ff.title || f.title, date: ff.date || f.date, notes: ff.notes }
          : f
      )
    );
    setShowFirst(false);
    setFF({});
    setEditFirstId(null);
    toast("Memory updated!");
  }

  // Delete memory/first
  function deleteFirst(id: number) {
    setFirsts((p) => p.filter((f) => f.id !== id));
    setShowFirst(false);
    setFF({});
    setEditFirstId(null);
    toast("Memory deleted");
  }

  // Open edit modal for existing memory
  function openEditFirst(f: MilestoneItem) {
    setFF({ title: f.title, date: f.date, notes: f.notes || "" });
    setEditFirstId(f.id);
    setShowFirst(true);
  }

  // Calculate progress
  let totalAll = 0;
  let doneAll = 0;
  months.forEach((m) => {
    const msd = MILESTONES[m];
    const items = [...(msd.motor || []), ...(msd.cog || []), ...(msd.soc || []), ...(msd.lang || [])];
    totalAll += items.length;
    if (checked[m]) {
      doneAll += Object.values(checked[m]).filter(Boolean).length;
    }
  });

  const teethDone = Object.values(teeth).filter(Boolean).length;
  const firstsDone = firsts.length;

  // Toggle section expansion
  function tg(id: string) {
    setEx((p) => ({ ...p, [id]: !p[id] }));
  }

  // Section header component
  function Sec(
    id: string,
    emoji: string,
    title: string,
    desc: string | null,
    color: string
  ) {
    return (
      <div
        id={'ml-' + id}
        style={{ marginBottom: expanded[id] ? 4 : 0 }}
      >
        <div
          onClick={() => tg(id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            cursor: "pointer",
            background: C.cd,
            borderRadius: expanded[id] ? "16px 16px 0 0" : "16px",
            border: "1px solid " + C.b,
            marginBottom: expanded[id] ? 0 : 8,
          }}
        >
          <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
              {title}
            </div>
            {desc && (
              <div
                style={{
                  fontSize: 11,
                  color: C.tl,
                  marginTop: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {desc}
              </div>
            )}
          </div>
          <Ic
            n="chevron-right"
            s={16}
            c={C.tl}
            st={{
              transform: expanded[id] ? "rotate(90deg)" : "none",
              transition: "transform 0.2s",
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    );
  }

  // SecBody moved outside component to fix keyboard dismiss bug (#70)

  return (
    <>
    <div className="ca" style={{ padding: "16px 16px 120px" }}>
      <SH icon="star" title="Milestones" color={C.p} sub="Tap any section to explore" />

      {/* ═══ DEVELOPMENT ═══ */}
      {Sec("dev", "⭐", "Development", doneAll + "/" + totalAll + " milestones checked", C.p)}
      {expanded.dev && (
        <SecBody>
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 8,
                marginBottom: 12,
              }}
            >
              {months.map((m) => (
                <Pill
                  key={m}
                  label={MILESTONES[m].e + " " + MILESTONES[m].l}
                  active={m === selMo}
                  onClick={() => setSelMo(m)}
                  color={C.p}
                />
              ))}
            </div>

            {ms && (
              <>
                <Cd
                  style={{
                    marginBottom: 12,
                    textAlign: "center",
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 36 }}>{ms.e}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: C.t, margin: "4px 0" }}>
                    {ms.l}
                  </h3>
                  <p style={{ fontSize: 13, color: C.tl, margin: 0 }}>{ms.r}</p>
                </Cd>

                {cats.map((cat) => {
                  const items = ms[cat.k] || [];
                  if (!items.length) return null;
                  const dn = items.filter((_, i) => checked[selMo]?.[cat.k + "_" + i])
                    .length;

                  return (
                    <Cd key={cat.k} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: cat.c + "15",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ic n={cat.icon} s={16} c={cat.c} />
                        </div>
                        <div
                          style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: 600,
                            color: C.t,
                          }}
                        >
                          {cat.l}
                        </div>
                        <div style={{ fontSize: 12, color: C.tl }}>
                          {dn}/{items.length}
                        </div>
                      </div>

                      {items.map((item, i) => {
                        const isC = checked[selMo]?.[cat.k + "_" + i];
                        return (
                          <div
                            key={i}
                            onClick={() => toggle(cat.k, i)}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "flex-start",
                              padding: "8px 0",
                              borderTop: i ? "1px solid " + C.b : "none",
                              cursor: "pointer",
                            }}
                          >
                            <CB ck={isC} color={cat.c} />
                            <span
                              style={{
                                fontSize: 13,
                                color: isC ? C.tl : C.t,
                                textDecoration: isC ? "line-through" : "none",
                                lineHeight: 1.4,
                              }}
                            >
                              {item}
                            </span>
                          </div>
                        );
                      })}
                    </Cd>
                  );
                })}

                <Cd style={{ borderLeft: "4px solid " + C.a, marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.a,
                      marginBottom: 4,
                    }}
                  >
                    Tip
                  </div>
                  <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5 }}>
                    {ms.tips}
                  </div>
                </Cd>
              </>
            )}
          </>
        </SecBody>
      )}

      {/* ═══ TEETH ═══ */}
      {Sec("teeth", "🦷", "Teeth Tracker", teethDone + "/20 erupted", C.p)}
      {expanded.teeth && (
        <SecBody>
          <>
            <Cd
              style={{
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 800, color: C.p }}>
                {teethDone} / 20
              </div>
              <div style={{ fontSize: 12, color: C.tl }}>
                teeth erupted — tap to toggle
              </div>
            </Cd>

            {TEETH_ORDER.map((tooth, i) => {
              const date = teeth[i];
              return (
                <Cd
                  key={i}
                  onClick={() => toggleTooth(i)}
                  style={{
                    marginBottom: 8,
                    padding: 14,
                    cursor: "pointer",
                    borderLeft: date ? "4px solid " + C.ok : "4px solid " + C.b,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
                        {tooth.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.tl }}>
                        Expected: {tooth.age}
                      </div>
                    </div>
                    {date ? (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.ok,
                        }}
                      >
                        {fmtDate(date)} ✓
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.tl }}>Tap when erupted</div>
                    )}
                  </div>
                </Cd>
              );
            })}
          </>
        </SecBody>
      )}

      {/* ═══ FIRSTS / MEMORY BOOK ═══ */}
      {Sec("firsts", "✨", "Baby Firsts", firstsDone + " memories recorded", C.s)}
      {expanded.firsts && (
        <SecBody>
          <>
            <Btn
              label="+ Record a First"
              onClick={() => {
                setFF({});
                setEditFirstId(null);
                setShowFirst(true);
              }}
              color={C.s}
              full
            />

            <div style={{ marginTop: 12 }}>
              {PRESET_MILESTONES.map((milestone) => {
                const existing = firsts.find((f) => f.title === milestone);
                return (
                  <Cd
                    key={milestone}
                    style={{
                      marginBottom: 8,
                      padding: 14,
                      opacity: existing ? 1 : 0.6,
                      borderLeft: existing ? "4px solid " + C.ok : "none",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (existing) {
                        openEditFirst(existing);
                      } else {
                        setFF({ title: milestone });
                        setEditFirstId(null);
                        setShowFirst(true);
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
                          {milestone}
                        </div>
                        {existing ? (
                          <div style={{ fontSize: 12, color: C.tl }}>
                            {fmtDate(existing.date)}
                            {existing.notes ? " — " + existing.notes : ""}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: C.tl }}>Tap to record</div>
                        )}
                      </div>
                      {existing && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ fontSize: 10, color: C.tl }}>tap to edit</div>
                          <div style={{ color: C.ok, fontSize: 20 }}>✓</div>
                        </div>
                      )}
                    </div>
                  </Cd>
                );
              })}

              {firsts
                .filter((f) => !PRESET_MILESTONES.includes(f.title))
                .map((f) => (
                  <Cd
                    key={f.id}
                    style={{
                      marginBottom: 8,
                      padding: 14,
                      borderLeft: "4px solid " + C.s,
                      cursor: "pointer",
                    }}
                    onClick={() => openEditFirst(f)}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
                          {f.title}
                        </div>
                        <div style={{ fontSize: 12, color: C.tl }}>
                          {fmtDate(f.date)}
                          {f.notes ? " — " + f.notes : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: C.tl }}>tap to edit</div>
                    </div>
                  </Cd>
                ))}
            </div>

          </>
        </SecBody>
      )}

      {/* ═══ RED FLAGS ═══ */}
      {Sec("red", "🚩", "Red Flags", "When to talk to your doctor", C.p)}
      {expanded.red && (
        <SecBody>
          <>
            <Cd
              style={{
                marginBottom: 12,
                borderLeft: "4px solid " + C.p,
                background: C.pl + "66",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.p,
                  marginBottom: 4,
                }}
              >
                Important
              </div>
              <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5 }}>
                These are signs that warrant a conversation with your pediatrician. Every
                child develops differently, but early intervention can make a huge
                difference.
              </div>
            </Cd>

            {months.map((m) => {
              const ms2 = MILESTONES[m];
              if (!ms2.red || !ms2.red.length) return null;

              return (
                <Cd
                  key={m}
                  style={{
                    marginBottom: 10,
                    borderLeft: m <= age ? "4px solid " + C.w : "none",
                    opacity: m <= age ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: C.t,
                      marginBottom: 8,
                    }}
                  >
                    {ms2.e} {ms2.l}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.p,
                      marginBottom: 6,
                    }}
                  >
                    Talk to your doctor if baby:
                  </div>
                  <Dot items={ms2.red} color={C.p} />
                </Cd>
              );
            })}
          </>
        </SecBody>
      )}
    </div>

      {/* First memory modal — rendered outside .ca scroll container for iOS fixed-position support */}
      {showFirst && (
        <div
          className="mo"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFirst(false);
              setEditFirstId(null);
              setFF({});
            }
          }}
        >
          <div className="ms">
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: C.t,
                marginBottom: 16,
              }}
            >
              {editFirstId ? "Edit Memory" : "Record a First"}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.tl,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                What happened?
              </label>
              <Input
                value={ff.title || ""}
                onChange={(v) => setFF({ ...ff, title: v })}
                placeholder="e.g. First Laugh"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.tl,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Date
              </label>
              <Input
                type="date"
                value={ff.date || today()}
                onChange={(v) => setFF({ ...ff, date: v })}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.tl,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Notes
              </label>
              <Input
                value={ff.notes || ""}
                onChange={(v) => setFF({ ...ff, notes: v })}
                placeholder="How it happened..."
              />
            </div>

            <Btn
              label={editFirstId ? "Update Memory" : "Save Memory"}
              onClick={editFirstId ? updateFirst : addFirst}
              color={C.s}
              full
            />

            {editFirstId && (
              <div
                onClick={() => deleteFirst(editFirstId)}
                style={{
                  textAlign: "center",
                  padding: "12px 0",
                  marginTop: 8,
                  color: C.p,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete this memory
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MilestonesTab;
