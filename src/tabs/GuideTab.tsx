import React, { useState, useEffect } from 'react';
import { C } from '@/lib/constants/colors';
import {
  SLEEP,
  NAP_GUIDE,
  FEEDING,
  SOLIDS_GUIDE,
  MILK_GUIDE,
  BOTTLE_GUIDE,
  FORMULA_GUIDE,
  GROWTH,
  SCREEN_TIME,
  ACTIVITIES,
  REMEDIES,
  MASSAGE_GUIDE,
  TUMMY_TIME_GUIDE,
  MOM_NUTRITION,
  VISITS,
} from '@/lib/constants/guides';
import { VACCINES } from '@/lib/constants/vaccines';
import {
  Icon,
  Card,
  SectionHeader,
  ProgressCircle,
  Checkbox,
  Dot,
  Pill,
} from '@/components/shared';
import GrowthChart from '@/components/charts/GrowthChart';
import MedCalc from '@/features/settings/MedCalc';

interface GuideTabProps {
  age: number;
  vDone: { [key: string]: boolean };
  setVDone: (updater: (prev: { [key: string]: boolean }) => { [key: string]: boolean }) => void;
  subNavRef: React.MutableRefObject<string | null>;
  logs?: { growth?: Array<{ date: string; weight?: string; height?: string }> };
  birth: string;
}

interface Expanded {
  [key: string]: boolean;
}

interface DietOption {
  id: 'veg' | 'nonveg' | 'vegan';
  l: string;
}

export default function GuideTab({ age, vDone, setVDone, subNavRef, logs, birth }: GuideTabProps) {
  // Initialize expanded state from subNavRef
  const initExp = (): Expanded => {
    if (subNavRef && subNavRef.current) {
      const o: Expanded = {};
      o[subNavRef.current] = true;
      return o;
    }
    return {};
  };

  const [expanded, setEx] = useState<Expanded>(initExp());
  const [diet, setDiet] = useState<'veg' | 'nonveg' | 'vegan'>('veg');

  // Handle auto-expansion and scrolling
  useEffect(() => {
    if (subNavRef && subNavRef.current) {
      const tgt = subNavRef.current;
      setEx((p) => {
        const n = Object.assign({}, p);
        n[tgt] = true;
        return n;
      });
      subNavRef.current = null;
      setTimeout(() => {
        const el = document.getElementById('gs-' + tgt);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  }, [subNavRef]);

  // Age mapping for vaccine schedules
  const ageMap: { [key: string]: number } = {
    Birth: 0,
    '1 Month': 1,
    '2 Months': 2,
    '4 Months': 4,
    '6 Months': 6,
    '9 Months': 9,
    '12 Months': 12,
    '15 Months': 15,
    '18 Months': 18,
  };

  // Toggle vaccine done
  const toggleV = (ai: number, vi: number) => {
    const k = ai + '_' + vi;
    setVDone((p) => {
      const n = Object.assign({}, p);
      n[k] = !p[k];
      return n;
    });
  };

  // Calculate current section indices
  const curSI = age < 4 ? 0 : age < 6 ? 1 : age < 9 ? 2 : age < 12 ? 3 : age < 18 ? 4 : 5;
  const curFI =
    age < 4 ? 0 : age < 6 ? 1 : age < 8 ? 2 : age < 10 ? 3 : age < 12 ? 4 : 5;
  const curAct =
    age < 1
      ? 0
      : age < 2
        ? 1
        : age < 4
          ? 2
          : age < 6
            ? 4
            : age < 9
              ? 6
              : age < 12
                ? 9
                : age < 18
                  ? 12
                  : age < 24
                    ? 18
                    : 24;

  // Calculate vaccine progress
  const totalV = VACCINES.reduce((s, v) => s + v.v.length, 0);
  const doneC = Object.values(vDone).filter(Boolean).length;

  // Toggle expansion
  const tg = (id: string) => {
    setEx((p) => {
      const n = Object.assign({}, p);
      n[id] = !n[id];
      return n;
    });
  };

  // Section header component
  const Sec = (
    id: string,
    emoji: string,
    title: string,
    desc: string | null,
    color: string,
    isNow: boolean
  ) => (
    <div
      id={'gs-' + id}
      style={{ marginBottom: expanded[id] ? 4 : 0 }}
      key={id}
    >
      <div
        onClick={() => tg(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          background: C.cd,
          borderRadius: expanded[id] ? '16px 16px 0 0' : 16,
          border: '1px solid ' + C.b,
          borderBottom: expanded[id] ? '1px solid ' + C.b : '1px solid ' + C.b,
          marginBottom: expanded[id] ? 0 : 8,
        }}
      >
        <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>{title}</div>
          {desc ? (
            <div
              style={{
                fontSize: 11,
                color: C.tl,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {desc}
            </div>
          ) : null}
        </div>
        {isNow ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: color,
              background: color + '22',
              padding: '2px 6px',
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            NOW
          </span>
        ) : null}
        <Icon
          n="chevron-right"
          s={16}
          c={C.tl}
          st={{
            transform: expanded[id] ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        />
      </div>
    </div>
  );

  // Section body component
  const SecBody = (children: React.ReactNode) => (
    <div
      style={{
        background: C.cd,
        borderRadius: '0 0 16px 16px',
        border: '1px solid ' + C.b,
        borderTop: 'none',
        padding: '12px 16px 16px',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="ca" style={{ padding: '16px 16px 120px' }}>
      <SectionHeader icon="book" title="Guide" color={C.a} sub="Tap any section to explore" />

      {/* Vaccines */}
      {Sec('vaccines', '🩺', 'Vaccines', doneC + '/' + totalV + ' recorded', C.bl, false)}
      {expanded.vaccines
        ? SecBody(
            <>
              <Card
                style={{
                  marginBottom: 12,
                  textAlign: 'center',
                  padding: 16,
                }}
              >
                <ProgressCircle pct={Math.round((doneC / totalV) * 100)} sz={70} sw={5} color={C.bl} />
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: C.t }}>
                  {doneC}/{totalV} recorded
                </div>
              </Card>
              {VACCINES.map((g, ai) => {
                const vA = ageMap[g.age] != null ? ageMap[g.age] : 0;
                const isPast = vA < age;
                const isCur = vA >= age && vA < age + 3;
                return (
                  <Card
                    key={ai}
                    style={{
                      marginBottom: 8,
                      padding: 14,
                      borderLeft: isCur ? '3px solid ' + C.bl : isPast ? '3px solid ' + C.ok : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>{g.age}</div>
                      {isCur ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: C.bl,
                            background: C.bll,
                            padding: '2px 8px',
                            borderRadius: 8,
                          }}
                        >
                          UPCOMING
                        </span>
                      ) : null}
                    </div>
                    {g.v.map((v, vi) => {
                      const isDone = vDone[ai + '_' + vi];
                      return (
                        <div
                          key={vi}
                          onClick={() => toggleV(ai, vi)}
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            padding: '6px 0',
                            borderTop: vi ? '1px solid ' + C.b : 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Checkbox ck={isDone} />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: isDone ? C.tl : C.t,
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}
                            >
                              {v.n}
                            </div>
                            <div style={{ fontSize: 11, color: C.tl }}>{v.d}</div>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                );
              })}
            </>
          )
        : null}

      {/* Sleep */}
      {Sec('sleep', '😴', 'Sleep Guide', SLEEP[curSI].total + ' — ' + SLEEP[curSI].age, C.pu, true)}
      {expanded.sleep
        ? SecBody(
            <>
              {SLEEP.map((st, i) => (
                <Card
                  key={i}
                  style={{
                    marginBottom: 10,
                    borderLeft: i === curSI ? '3px solid ' + C.pu : 'none',
                    opacity: i < curSI ? 0.5 : 1,
                  }}
                >
                  {i === curSI ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.pu,
                        background: C.pul,
                        padding: '2px 8px',
                        borderRadius: 6,
                        marginBottom: 6,
                        display: 'inline-block',
                      }}
                    >
                      CURRENT
                    </span>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: C.t, margin: 0 }}>
                      {st.age}
                    </h3>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.pu }}>{st.total}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.t, marginBottom: 4 }}>
                    <b>Pattern: </b>
                    {st.pat}
                  </div>
                  <div style={{ fontSize: 12, color: C.t, marginBottom: 6 }}>
                    <b>Naps: </b>
                    {st.naps}
                  </div>
                  <Dot items={st.tips} color={C.pu} />
                </Card>
              ))}
            </>
          )
        : null}

      {/* Nap Guide */}
      {Sec(
        'naps',
        '💤',
        'Nap Schedule',
        NAP_GUIDE[
          age < 0.5 ? 0 : age < 3 ? 1 : age < 5 ? 2 : age < 8 ? 3 : age < 12 ? 4 : age < 15 ? 5 : age < 18 ? 6 : 7
        ].naps +
          ' naps, wake ' +
          NAP_GUIDE[
            age < 0.5 ? 0 : age < 3 ? 1 : age < 5 ? 2 : age < 8 ? 3 : age < 12 ? 4 : age < 15 ? 5 : age < 18 ? 6 : 7
          ].wake,
        C.pu,
        true
      )}
      {expanded.naps
        ? SecBody(
            <>
              {NAP_GUIDE.map((n, i) => {
                const curN =
                  age < 0.5 ? 0 : age < 3 ? 1 : age < 5 ? 2 : age < 8 ? 3 : age < 12 ? 4 : age < 15 ? 5 : age < 18 ? 6 : 7;
                return (
                  <Card
                    key={i}
                    style={{
                      marginBottom: 10,
                      borderLeft: i === curN ? '3px solid ' + C.pu : 'none',
                      opacity: i < curN ? 0.5 : 1,
                    }}
                  >
                    {i === curN ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.pu,
                          background: C.pul,
                          padding: '2px 8px',
                          borderRadius: 6,
                          marginBottom: 6,
                          display: 'inline-block',
                        }}
                      >
                        CURRENT
                      </span>
                    ) : null}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: C.t, margin: 0 }}>
                        {n.age}
                      </h3>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.pu }}>
                        {n.naps} naps
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: C.t, marginBottom: 4 }}>
                      <b>Wake window: </b>
                      {n.wake}
                    </div>
                    <div style={{ fontSize: 13, color: C.t, marginBottom: 6 }}>
                      <b>Total sleep: </b>
                      {n.total}
                    </div>
                    <Dot items={n.tips} color={C.pu} />
                  </Card>
                );
              })}
            </>
          )
        : null}

      {/* Feeding */}
      {Sec('feeding', '👶', 'Feeding Guide', FEEDING[curFI].amt, C.a, true)}
      {expanded.feeding
        ? SecBody(
            <>
              {FEEDING.map((st, i) => (
                <Card
                  key={i}
                  style={{
                    marginBottom: 10,
                    borderLeft: i === curFI ? '3px solid ' + C.a : 'none',
                    opacity: i < curFI ? 0.5 : 1,
                  }}
                >
                  {i === curFI ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.a,
                        background: C.al,
                        padding: '2px 8px',
                        borderRadius: 6,
                        marginBottom: 6,
                        display: 'inline-block',
                      }}
                    >
                      CURRENT
                    </span>
                  ) : null}
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.t, margin: '0 0 2px' }}>
                    {st.e} {st.t}
                  </h3>
                  <div style={{ fontSize: 12, color: C.tl, marginBottom: 6 }}>{st.age}</div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.a, marginBottom: 2 }}>
                      Foods
                    </div>
                    <Dot items={st.foods} color={C.a} />
                  </div>
                  <div style={{ fontSize: 12, color: C.t, marginBottom: 6 }}>
                    <b>Amount: </b>
                    {st.amt}
                  </div>
                  <Dot items={st.tips} color={C.p} />
                </Card>
              ))}
            </>
          )
        : null}

      {/* Solids Guide */}
      {Sec(
        'solids',
        '🥄',
        'Solid Foods',
        age < 6 ? 'Starting at 6 months' : 'WHO & AAP by diet',
        C.a,
        age >= 6
      )}
      {expanded.solids
        ? SecBody(
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(
                  [
                    { id: 'veg' as const, l: 'Vegetarian 🥬' },
                    { id: 'nonveg' as const, l: 'Non-Veg 🍗' },
                    { id: 'vegan' as const, l: 'Vegan 🌱' },
                  ] as DietOption[]
                ).map((d) => (
                  <Pill
                    key={d.id}
                    label={d.l}
                    active={diet === d.id}
                    onClick={() => setDiet(d.id)}
                    color={C.a}
                  />
                ))}
              </div>
              {Object.keys(SOLIDS_GUIDE[diet].foods)
                .map(Number)
                .sort((a, b) => a - b)
                .map((mo) => {
                  const isCur =
                    mo <= age * 1 &&
                    !Object.keys(SOLIDS_GUIDE[diet].foods)
                      .map(Number)
                      .find((x) => x > mo && x <= age);
                  return (
                    <Card
                      key={mo}
                      style={{ marginBottom: 10, borderLeft: isCur ? '3px solid ' + C.a : 'none' }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: C.t,
                          marginBottom: 8,
                        }}
                      >
                        {mo} Months
                        {mo === 6 ? ' — Starting Solids!' : ''}
                      </div>
                      {SOLIDS_GUIDE[diet].foods[mo].map((food, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: 8,
                            padding: '6px 0',
                            borderTop: i ? '1px solid ' + C.b : 'none',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: C.t,
                              flex: 1,
                            }}
                          >
                            {food.f}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: C.tl,
                              flexShrink: 0,
                              maxWidth: '40%',
                              textAlign: 'right',
                            }}
                          >
                            {food.n}
                          </div>
                        </div>
                      ))}
                    </Card>
                  );
                })}
              <Card style={{ marginBottom: 10, borderLeft: '4px solid ' + C.w, background: C.wl }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 6,
                  }}
                >
                  {SOLIDS_GUIDE.allergens.title}
                </div>
                <Dot items={SOLIDS_GUIDE.allergens.items} color={C.w} />
                <div
                  style={{
                    fontSize: 12,
                    color: C.t,
                    marginTop: 6,
                    fontStyle: 'italic',
                  }}
                >
                  {SOLIDS_GUIDE.allergens.tip}
                </div>
              </Card>
              <Card style={{ borderLeft: '4px solid ' + C.a }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.a,
                    marginBottom: 4,
                  }}
                >
                  Key Rules
                </div>
                <Dot
                  items={[
                    'One new food every 3-5 days',
                    'Offer before milk at 9+ months',
                    'No honey until 12 months',
                    "No cow's milk as drink until 12 months",
                    'No added salt or sugar under 12 months',
                    'Cut round foods (grapes, cherry tomatoes) lengthwise',
                    'Always supervise eating',
                  ]}
                  color={C.a}
                />
              </Card>
            </>
          )
        : null}

      {/* Milk Guide */}
      {Sec(
        'milk',
        '🍼',
        'Milk Intake Guide',
        MILK_GUIDE[age < 1 ? 0 : age < 2 ? 1 : age < 4 ? 2 : age < 6 ? 3 : age < 9 ? 4 : age < 12 ? 5 : age < 18 ? 6 : 7]
          .total,
        C.bl,
        true
      )}
      {expanded.milk
        ? SecBody(
            <>
              {MILK_GUIDE.map((m, i) => {
                const curM =
                  age < 1 ? 0 : age < 2 ? 1 : age < 4 ? 2 : age < 6 ? 3 : age < 9 ? 4 : age < 12 ? 5 : age < 18 ? 6 : 7;
                return (
                  <Card
                    key={i}
                    style={{
                      marginBottom: 10,
                      borderLeft: i === curM ? '3px solid ' + C.bl : 'none',
                      opacity: i < curM ? 0.5 : 1,
                    }}
                  >
                    {i === curM ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.bl,
                          background: C.bll,
                          padding: '2px 8px',
                          borderRadius: 6,
                          marginBottom: 6,
                          display: 'inline-block',
                        }}
                      >
                        CURRENT
                      </span>
                    ) : null}
                    <h3
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: C.t,
                        margin: '0 0 6px',
                      }}
                    >
                      {m.age}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                      <div style={{ background: C.bg, borderRadius: 8, padding: 8 }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: C.tl,
                          }}
                        >
                          BREASTFED
                        </div>
                        <div style={{ fontSize: 12, color: C.t }}>{m.breast}</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 8, padding: 8 }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: C.tl,
                          }}
                        >
                          FORMULA
                        </div>
                        <div style={{ fontSize: 12, color: C.t }}>{m.formula}</div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.bl,
                        marginBottom: 4,
                      }}
                    >
                      Total: {m.total}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.tl,
                        fontStyle: 'italic',
                      }}
                    >
                      {m.notes}
                    </div>
                  </Card>
                );
              })}
            </>
          )
        : null}

      {/* Bottles */}
      {Sec('bottles', '🍼', 'Bottle Guide', 'Types, nipples & tips', C.bl, age < 18)}
      {expanded.bottles
        ? SecBody(
            <>
              {[BOTTLE_GUIDE.types, BOTTLE_GUIDE.nipples, BOTTLE_GUIDE.tips].map((sec) => (
                <Card key={sec.title} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: C.t,
                      marginBottom: 8,
                    }}
                  >
                    {sec.title}
                  </div>
                  {sec.items.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 0',
                        borderTop: i ? '1px solid ' + C.b : 'none',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>
                        {typeof item === 'string' ? item : item.r}
                      </div>
                      {typeof item !== 'string' && item.d ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: C.tl,
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          {item.d}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </Card>
              ))}
            </>
          )
        : null}

      {/* Formula Guide */}
      {Sec('formulaguide', '🥛', 'Formula Guide', 'Types, choosing & prep', C.w, age < 12)}
      {expanded.formulaguide
        ? SecBody(
            <>
              <Card
                style={{
                  marginBottom: 10,
                  borderLeft: '4px solid ' + C.w,
                  background: C.wl,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.w,
                    marginBottom: 4,
                  }}
                >
                  Important
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.t,
                    lineHeight: 1.5,
                  }}
                >
                  Always consult your pediatrician before choosing or switching formula. Every baby is
                  different. Brand recommendations are not included — all US formula meets FDA standards.
                </div>
              </Card>
              {[FORMULA_GUIDE.types, FORMULA_GUIDE.choosing, FORMULA_GUIDE.prep].map((sec) => (
                <Card key={sec.title} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: C.t,
                      marginBottom: 8,
                    }}
                  >
                    {sec.title}
                  </div>
                  {sec.items.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 0',
                        borderTop: i ? '1px solid ' + C.b : 'none',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>
                        {item.r}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: C.tl,
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.d}
                      </div>
                    </div>
                  ))}
                </Card>
              ))}
            </>
          )
        : null}

      {/* Growth */}
      {Sec('growth', '🌱', 'Growth Charts', 'WHO percentile curves', C.p, false)}
      {expanded.growth
        ? (() => {
            const babyW = (logs?.growth || [])
              .filter((e) => e.weight)
              .map((e) => {
                const bd = new Date(birth + 'T00:00:00');
                const ed = new Date(e.date + 'T00:00:00');
                const mo =
                  (ed.getFullYear() - bd.getFullYear()) * 12 +
                  (ed.getMonth() - bd.getMonth()) +
                  (ed.getDate() - bd.getDate()) / 30;
                return {
                  month: Math.max(0, Math.min(24, mo)),
                  value: parseFloat(e.weight!),
                };
              })
              .sort((a, b) => a.month - b.month);

            const babyH = (logs?.growth || [])
              .filter((e) => e.height)
              .map((e) => {
                const bd = new Date(birth + 'T00:00:00');
                const ed = new Date(e.date + 'T00:00:00');
                const mo =
                  (ed.getFullYear() - bd.getFullYear()) * 12 +
                  (ed.getMonth() - bd.getMonth()) +
                  (ed.getDate() - bd.getDate()) / 30;
                return {
                  month: Math.max(0, Math.min(24, mo)),
                  value: parseFloat(e.height!),
                };
              })
              .sort((a, b) => a.month - b.month);

            return SecBody(
              <>
                <Card style={{ marginBottom: 12 }}>
                  <GrowthChart data={GROWTH.w} babyData={babyW} label="Weight" color={C.p} unit="lbs" />
                  {babyW.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: 12,
                        color: C.tl,
                        padding: 8,
                      }}
                    >
                      Log growth data to see your baby's curve
                    </div>
                  ) : null}
                </Card>
                <Card style={{ marginBottom: 12 }}>
                  <GrowthChart data={GROWTH.h} babyData={babyH} label="Height" color={C.s} unit="in" />
                  {babyH.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: 12,
                        color: C.tl,
                        padding: 8,
                      }}
                    >
                      Log growth data to see your baby's curve
                    </div>
                  ) : null}
                </Card>
                <Card style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.t, marginBottom: 8 }}>
                    Weight (lbs) — WHO
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid ' + C.b }}>
                        {['Age', '5th', '50th', '95th'].map((hd, i) => (
                          <th
                            key={i}
                            style={{
                              textAlign: i ? 'center' : 'left',
                              padding: 6,
                              color: i === 2 ? C.p : C.tl,
                              fontWeight: i === 2 ? 700 : 500,
                            }}
                          >
                            {hd}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GROWTH.w.map((r, i) => {
                        const cur = r.m <= age && (i === GROWTH.w.length - 1 || GROWTH.w[i + 1].m > age);
                        return (
                          <tr
                            key={i}
                            style={{
                              borderBottom: '1px solid ' + C.b,
                              background: cur ? C.pl : 'transparent',
                            }}
                          >
                            <td style={{ padding: 6, fontWeight: 600 }}>
                              {r.m === 0 ? 'Birth' : r.m + 'mo'}
                            </td>
                            <td style={{ textAlign: 'center', padding: 6 }}>{r.p5}</td>
                            <td
                              style={{
                                textAlign: 'center',
                                padding: 6,
                                fontWeight: 700,
                                color: C.p,
                              }}
                            >
                              {r.p50}
                            </td>
                            <td style={{ textAlign: 'center', padding: 6 }}>{r.p95}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
                <Card style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.t, marginBottom: 8 }}>
                    Height (in) — WHO
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid ' + C.b }}>
                        {['Age', '5th', '50th', '95th'].map((hd, i) => (
                          <th
                            key={i}
                            style={{
                              textAlign: i ? 'center' : 'left',
                              padding: 6,
                              color: i === 2 ? C.s : C.tl,
                              fontWeight: i === 2 ? 700 : 500,
                            }}
                          >
                            {hd}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GROWTH.h.map((r, i) => {
                        const cur = r.m <= age && (i === GROWTH.h.length - 1 || GROWTH.h[i + 1].m > age);
                        return (
                          <tr
                            key={i}
                            style={{
                              borderBottom: '1px solid ' + C.b,
                              background: cur ? C.sl : 'transparent',
                            }}
                          >
                            <td style={{ padding: 6, fontWeight: 600 }}>
                              {r.m === 0 ? 'Birth' : r.m + 'mo'}
                            </td>
                            <td style={{ textAlign: 'center', padding: 6 }}>{r.p5}</td>
                            <td
                              style={{
                                textAlign: 'center',
                                padding: 6,
                                fontWeight: 700,
                                color: C.s,
                              }}
                            >
                              {r.p50}
                            </td>
                            <td style={{ textAlign: 'center', padding: 6 }}>{r.p95}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </>
            );
          })()
        : null}

      {/* Screen Time */}
      {Sec('screen', '🌈', 'Screen Time', 'AAP guidelines', C.s, false)}
      {expanded.screen
        ? SecBody(
            <>
              {SCREEN_TIME.map((s, i) => (
                <Card key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t, marginBottom: 2 }}>
                    {s.age}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.s, marginBottom: 4 }}>
                    {s.rule}
                  </div>
                  <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5 }}>{s.detail}</div>
                </Card>
              ))}
              <Card style={{ borderLeft: '4px solid ' + C.a }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.a,
                    marginBottom: 4,
                  }}
                >
                  Better Alternatives
                </div>
                <Dot
                  items={[
                    'Read books together',
                    'Sing songs and nursery rhymes',
                    'Play outside',
                    'Floor time with toys',
                    'Art and sensory play',
                    'Talk and describe the world',
                  ]}
                  color={C.a}
                />
              </Card>
            </>
          )
        : null}

      {/* Activities */}
      {Sec('activities', '🧸', 'Activities', 'Age-appropriate play ideas', C.w, true)}
      {expanded.activities
        ? SecBody(
            <>
              {Object.keys(ACTIVITIES)
                .map(Number)
                .sort((a, b) => a - b)
                .map((m) => {
                  const isCur =
                    m <= age &&
                    (m === 24 ||
                      (Object.keys(ACTIVITIES)
                        .map(Number)
                        .sort((a, b) => a - b)
                        .find((x) => x > m) ?? Infinity) > age);
                  return (
                    <Card
                      key={m}
                      style={{
                        marginBottom: 10,
                        borderLeft: isCur ? '3px solid ' + C.w : 'none',
                        opacity: m > age + 3 ? 0.4 : 1,
                      }}
                    >
                      {isCur ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: C.w,
                            background: C.wl,
                            padding: '2px 8px',
                            borderRadius: 6,
                            marginBottom: 6,
                            display: 'inline-block',
                          }}
                        >
                          CURRENT AGE
                        </span>
                      ) : null}
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: C.t,
                          marginBottom: 6,
                        }}
                      >
                        {m === 0 ? 'Newborn' : m + ' Months'}
                      </div>
                      <Dot items={ACTIVITIES[m]} color={C.w} />
                    </Card>
                  );
                })}
            </>
          )
        : null}

      {/* Tummy Time Guide */}
      {Sec('tummytime', '🧒', 'Tummy Time Guide', 'Benefits, positions & safety tips', C.s, age < 12)}
      {expanded.tummytime
        ? SecBody(
            <>
              <Card style={{ marginBottom: 12, borderLeft: '4px solid ' + C.s }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 22 }}>{TUMMY_TIME_GUIDE.benefits.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
                    {TUMMY_TIME_GUIDE.benefits.title}
                  </div>
                </div>
                <Dot items={TUMMY_TIME_GUIDE.benefits.items.filter((x): x is string => typeof x === 'string')} color={C.s} />
              </Card>
              {(['ageGuide', 'positions', 'tips', 'safety'] as const).map((key) => {
                const sec = TUMMY_TIME_GUIDE[key];
                return (
                  <Card key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 24 }}>{sec.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.t }}>{sec.title}</div>
                    </div>
                    {sec.items.map((item, i) => {
                      const mi = typeof item === 'string' ? { r: item, d: '' } : item;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '8px 0',
                            borderTop: i ? '1px solid ' + C.b : 'none',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.s }}>{mi.r}</div>
                          {mi.d ? (
                            <div style={{ fontSize: 12, color: C.t, lineHeight: 1.5, marginTop: 2 }}>
                              {mi.d}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </Card>
                );
              })}
            </>
          )
        : null}

      {/* Remedies */}
      {Sec('remedies', '🌿', 'Common Remedies', 'Gas, reflux, low milk & more', C.p, false)}
      {expanded.remedies
        ? SecBody(
            <>
              {Object.keys(REMEDIES).map((key) => {
                const sec = REMEDIES[key];
                return (
                  <Card key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 24 }}>{sec.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.t }}>{sec.title}</div>
                    </div>
                    {sec.items.map((item, i) => {
                      const mi = typeof item === 'string' ? { r: item, d: '' } : item;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '8px 0',
                            borderTop: i ? '1px solid ' + C.b : 'none',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.s }}>
                            {mi.r}
                          </div>
                          {mi.d ? (
                            <div
                              style={{
                                fontSize: 12,
                                color: C.t,
                                lineHeight: 1.5,
                                marginTop: 2,
                              }}
                            >
                              {mi.d}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </Card>
                );
              })}
            </>
          )
        : null}

      {/* Baby Massage Guide */}
      {Sec('massage', '🤲', 'Baby Massage Guide', 'Techniques, oils & best practices', C.pu, false)}
      {expanded.massage
        ? SecBody(
            <>
              <Card
                style={{
                  marginBottom: 12,
                  borderLeft: '4px solid ' + C.pu,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 22 }}>{MASSAGE_GUIDE.benefits.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
                    {MASSAGE_GUIDE.benefits.title}
                  </div>
                </div>
                <Dot items={MASSAGE_GUIDE.benefits.items.filter((x): x is string => typeof x === 'string')} color={C.pu} />
              </Card>
              {(['bestTime', 'oils', 'techniques', 'ageGuide', 'tips'] as const).map((key) => {
                const sec = MASSAGE_GUIDE[key];
                return (
                  <Card key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 24 }}>{sec.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.t }}>{sec.title}</div>
                    </div>
                    {sec.items.map((item, i) => {
                      const mi = typeof item === 'string' ? { r: item, d: '' } : item;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '8px 0',
                            borderTop: i ? '1px solid ' + C.b : 'none',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.s }}>
                            {mi.r}
                          </div>
                          {mi.d ? (
                            <div
                              style={{
                                fontSize: 12,
                                color: C.t,
                                lineHeight: 1.5,
                                marginTop: 2,
                              }}
                            >
                              {mi.d}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </Card>
                );
              })}
            </>
          )
        : null}

      {/* Mom Nutrition */}
      {Sec('momfood', '🤱', 'Mom Nutrition', 'What to eat while breastfeeding', C.pu, false)}
      {expanded.momfood
        ? SecBody(
            <>
              <Card style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 6,
                  }}
                >
                  {MOM_NUTRITION.general.title}
                </div>
                <Dot items={MOM_NUTRITION.general.items} color={C.a} />
              </Card>
              <Card
                style={{
                  marginBottom: 12,
                  borderLeft: '4px solid ' + C.ok,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 6,
                  }}
                >
                  {MOM_NUTRITION.eat.title}
                </div>
                <Dot items={MOM_NUTRITION.eat.items} color={C.ok} />
              </Card>
              <Card
                style={{
                  marginBottom: 12,
                  borderLeft: '4px solid ' + C.p,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 6,
                  }}
                >
                  {MOM_NUTRITION.avoid.title}
                </div>
                <Dot items={MOM_NUTRITION.avoid.items} color={C.p} />
              </Card>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.t,
                  marginBottom: 8,
                }}
              >
                By Stage
              </div>
              {MOM_NUTRITION.byMonth.map((stage, i) => (
                <Card key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>
                    {stage.period}
                  </div>
                  <div style={{ fontSize: 12, color: C.s, fontWeight: 600, marginBottom: 6 }}>
                    {stage.focus}
                  </div>
                  <Dot items={stage.tips} color={C.pu} />
                </Card>
              ))}
            </>
          )
        : null}

      {/* Parent Wellness */}
      {Sec('wellness', '💜', 'Parent Wellness', 'Your health matters too', C.pu, false)}
      {expanded.wellness
        ? SecBody(
            <>
              <Card
                style={{
                  marginBottom: 12,
                  borderLeft: '4px solid ' + C.p,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 6,
                  }}
                >
                  Postpartum Warning Signs
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: C.t,
                    lineHeight: 1.5,
                    marginBottom: 6,
                  }}
                >
                  Contact your doctor if you experience any of these for more than 2 weeks:
                </div>
                <Dot
                  items={[
                    'Persistent sadness or hopelessness',
                    'Severe mood swings',
                    'Difficulty bonding with your baby',
                    'Withdrawing from family/friends',
                    'Loss of appetite or overeating',
                    'Inability to sleep (even when baby sleeps)',
                    'Overwhelming fatigue or loss of energy',
                    'Intense irritability or anger',
                    'Fear of not being a good parent',
                    'Thoughts of harming yourself or baby',
                  ]}
                  color={C.p}
                />
              </Card>
              <Card style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 6,
                  }}
                >
                  Self-Care Checklist
                </div>
                <Dot
                  items={[
                    'Sleep when baby sleeps',
                    'Accept help when offered',
                    'Stay hydrated (water bottle nearby)',
                    'Eat regular, nourishing meals',
                    'Gentle movement when cleared by doctor',
                    'Connect with other parents',
                    'Take breaks — even 10 minutes count',
                    'Limit visitors when overwhelmed',
                    'Talk about your feelings',
                    "Remember: perfect parenting doesn't exist",
                  ]}
                  color={C.a}
                />
              </Card>
              <Card
                style={{
                  marginBottom: 12,
                  borderLeft: '4px solid ' + C.w,
                  background: C.wl,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 4,
                  }}
                >
                  Edinburgh Postnatal Depression Scale (EPDS)
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: C.t,
                    lineHeight: 1.5,
                  }}
                >
                  Ask your OB or midwife about the EPDS screening at your 6-week postpartum visit. It's a
                  simple 10-question questionnaire that can help identify postpartum depression early. Don't
                  hesitate — PPD affects up to 1 in 5 mothers and is very treatable.
                </div>
              </Card>
              <Card style={{ background: C.al, border: 'none' }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.t,
                    marginBottom: 6,
                  }}
                >
                  Resources
                </div>
                <Dot
                  items={[
                    'Postpartum Support International: 1-800-944-4773',
                    'Crisis Text Line: Text HOME to 741741',
                    'National Suicide Prevention: 988',
                    'Your OB/GYN or midwife',
                    'Your pediatrician can help too',
                  ]}
                  color={C.a}
                />
              </Card>
            </>
          )
        : null}

      {/* Well-Child Visits */}
      {Sec('visits', '🏥', 'Well-Child Visits', 'Recommended check-up schedule', C.a, false)}
      {expanded.visits
        ? SecBody(
            <>
              {VISITS.map((v, i) => {
                const vm = parseFloat(v.a) || 0;
                const isPast = vm < age;
                const isCur = vm >= age && (i === 0 || parseFloat(VISITS[i - 1].a) < age);
                return (
                  <Card
                    key={i}
                    style={{
                      marginBottom: 8,
                      padding: 14,
                      opacity: isPast && !isCur ? 0.5 : 1,
                      borderLeft: isCur ? '3px solid ' + C.a : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {isPast && !isCur ? (
                        <Icon n="check" s={18} c={C.ok} />
                      ) : isCur ? (
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            background: C.a,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            border: '2px solid ' + C.b,
                          }}
                        />
                      )}
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: C.t,
                          }}
                        >
                          {v.a}
                        </div>
                        <div style={{ fontSize: 12, color: C.tl }}>{v.f}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </>
          )
        : null}

      {/* Medicine Dosage Calculator */}
      {Sec('medcalc', '⚖️', 'Meds Calculator', 'Tylenol & Motrin dosing by weight', C.bl, false)}
      {expanded.medcalc ? SecBody(<MedCalc />) : null}
    </div>
  );
}
