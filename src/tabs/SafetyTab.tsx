import React, { useState, useEffect } from 'react';
import { C } from '@/lib/constants/colors';
import { Card as Cd, SectionHeader as SH, Icon as Ic, Dot } from '@/components/shared';
import AddContactForm from '@/components/modals/AddContactForm';
import type { CountryConfig } from '@/lib/constants/countries';

interface Contact {
  id: number;
  name: string;
  phone: string;
  role: string;
}

interface SafetyTabProps {
  subNavRef?: React.MutableRefObject<string | null>;
  emergencyContacts: Contact[];
  setEmergencyContacts: (contacts: Contact[]) => void;
  countryConfig: CountryConfig;
}

export default function SafetyTab({
  subNavRef,
  emergencyContacts,
  setEmergencyContacts,
  countryConfig,
}: SafetyTabProps) {
  // Use country-specific data
  const SAFETY = countryConfig.safety;
  const CPR_STEPS = countryConfig.cprSteps;
  const CHOKING_STEPS = countryConfig.chokingSteps;
  const FEVER_GUIDE = countryConfig.feverGuide;
  // Initialize expanded state based on subNavRef
  const initExp = subNavRef?.current
    ? { [subNavRef.current]: true }
    : {};

  const [expanded, setEx] = useState<Record<string, boolean>>(initExp);
  const [tipExp, setTipExp] = useState<number>(-1);

  // Handle deep linking from subNavRef
  useEffect(() => {
    if (subNavRef?.current) {
      const tgt = subNavRef.current;
      setEx((p) => {
        const n = { ...p };
        n[tgt] = true;
        return n;
      });
      subNavRef.current = null;
      setTimeout(() => {
        const el = document.getElementById(`sf-${tgt}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [subNavRef]);

  // Toggle section expansion
  function tg(id: string) {
    setEx((p) => {
      const n = { ...p };
      n[id] = !n[id];
      return n;
    });
  }

  // Accordion section header
  function Sec(
    id: string,
    emoji: string,
    title: string,
    desc?: string,
    color?: string
  ) {
    return (
      <div
        id={`sf-${id}`}
        style={{
          marginBottom: expanded[id] ? 4 : 0,
        }}
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
            border: `1px solid ${C.b}`,
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
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
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
              transform: expanded[id] ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    );
  }

  // Accordion section body
  function SecBody(children: React.ReactNode) {
    return (
      <div
        style={{
          background: C.cd,
          borderRadius: '0 0 16px 16px',
          border: `1px solid ${C.b}`,
          borderTop: 'none',
          padding: '12px 16px 16px',
          marginBottom: 10,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="ca" style={{ padding: '16px 16px 120px' }}>
      <SH icon="shield" title="Safety" color={C.p} sub="Tap any section to explore" />

      {/* Emergency banner (always visible) */}
      <Cd
        style={{
          marginBottom: 12,
          background: 'linear-gradient(135deg,#FF5252,#FF1744)',
          border: 'none',
          color: 'white',
          textAlign: 'center',
          padding: 16,
        }}
      >
        <Ic n="alert-triangle" s={24} c="white" />
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
          {countryConfig.emergency.bannerTitle}
        </div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          {countryConfig.emergency.bannerSubtitle}
        </div>
      </Cd>

      {/* Safety Tips */}
      {Sec('tips', '🏠', 'Safety Tips', `${SAFETY.length} categories`, C.p)}
      {expanded.tips &&
        SecBody(
          <div>
            {SAFETY.map((sec, i) => (
              <Cd
                key={i}
                onClick={() => setTipExp(tipExp === i ? -1 : i)}
                style={{ marginBottom: 10, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `${sec.c}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ic n={sec.icon} s={18} c={sec.c} />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 600,
                      color: C.t,
                    }}
                  >
                    {sec.t}
                  </div>
                  <Ic
                    n="chevron-right"
                    s={16}
                    c={C.tl}
                    st={{
                      transform: tipExp === i ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />
                </div>
                {tipExp === i && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: `1px solid ${C.b}`,
                    }}
                  >
                    <Dot items={sec.items} color={sec.c} />
                  </div>
                )}
              </Cd>
            ))}
          </div>
        )}

      {/* Infant CPR */}
      {Sec('cpr', '🫀', 'Infant CPR', 'Step-by-step reference guide', C.p)}
      {expanded.cpr &&
        SecBody(
          <>
            <Cd
              style={{
                marginBottom: 12,
                borderLeft: `4px solid ${C.p}`,
                background: `${C.pl}66`,
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
                Learn CPR In Person
              </div>
              <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5 }}>
                {countryConfig.cprDisclaimer}
              </div>
            </Cd>
            {CPR_STEPS.map((s) => (
              <Cd key={s.step} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      background: C.p,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {s.step}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: C.t,
                        marginBottom: 4,
                      }}
                    >
                      {s.title}
                    </div>
                    <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5 }}>
                      {s.detail}
                    </div>
                  </div>
                </div>
              </Cd>
            ))}
          </>
        )}

      {/* Choking */}
      {Sec(
        'choke',
        '🚨',
        'Choking Response',
        'Infant back blows & chest thrusts',
        C.w
      )}
      {expanded.choke &&
        SecBody(
          <>
            <Cd
              style={{
                marginBottom: 12,
                borderLeft: `4px solid ${C.w}`,
                background: C.wl,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.w,
                }}
              >
                For infants under 12 months
              </div>
              <div style={{ fontSize: 13, color: C.t, marginTop: 4 }}>
                Different technique than for adults/older children.
              </div>
            </Cd>
            {CHOKING_STEPS.map((s) => (
              <Cd key={s.step} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      background: C.w,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {s.step}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: C.t,
                        marginBottom: 4,
                      }}
                    >
                      {s.title}
                    </div>
                    <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5 }}>
                      {s.detail}
                    </div>
                  </div>
                </div>
              </Cd>
            ))}
          </>
        )}

      {/* Fever Guide */}
      {Sec('fever', '🌡️', 'Fever Guide', 'When to worry & what to do', C.bl)}
      {expanded.fever &&
        SecBody(
          <>
            <Cd style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.t,
                  marginBottom: 6,
                }}
              >
                How to Take Temperature
              </div>
              <Dot
                items={[
                  'Rectal is most accurate for infants (gold standard)',
                  'Forehead/temporal artery for quick checks',
                  countryConfig.defaults.temperatureUnit === 'F'
                    ? 'Under arm (axillary): add 1°F to reading'
                    : 'Under arm (axillary): add 0.5°C to reading',
                  `Normal: ${countryConfig.medical.normalTempRange}`,
                  'Do NOT use mercury thermometers',
                ]}
                color={C.bl}
              />
            </Cd>
            {FEVER_GUIDE.map((f, i) => (
              <Cd
                key={i}
                style={{
                  marginBottom: 10,
                  borderLeft: `4px solid ${f.urgent ? C.p : C.w}`,
                  background: f.urgent ? `${C.pl}44` : 'transparent',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>
                  {f.age}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: f.urgent ? C.p : C.w,
                    marginTop: 2,
                  }}
                >
                  {f.temp} → {f.action}
                </div>
                <div style={{ fontSize: 12, color: C.t, marginTop: 4, lineHeight: 1.5 }}>
                  {f.detail}
                </div>
              </Cd>
            ))}
            <Cd style={{ borderLeft: `4px solid ${C.a}` }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.a,
                  marginBottom: 4,
                }}
              >
                When in doubt, call your pediatrician
              </div>
              <div style={{ fontSize: 12, color: C.t, lineHeight: 1.5 }}>
                Trust your instincts. If your baby looks or acts very sick, don't
                wait — seek medical care regardless of the temperature reading.
              </div>
            </Cd>
          </>
        )}

      {/* Emergency Contacts */}
      {Sec(
        'contacts',
        '🆘',
        'Emergency Contacts',
        `${emergencyContacts.length} saved`,
        C.s
      )}
      {expanded.contacts &&
        SecBody(
          <>
            {emergencyContacts.map((c) => (
              <Cd
                key={c.id}
                style={{ marginBottom: 8, padding: 14 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 12, color: C.tl }}>
                      {c.role}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: C.s,
                        fontWeight: 600,
                      }}
                    >
                      {c.phone}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: C.ok,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      <span style={{ color: 'white', fontSize: 18 }}>
                        📞
                      </span>
                    </a>
                    {c.id > 2 && (
                      <button
                        onClick={() => {
                          const id = c.id;
                          setEmergencyContacts(
                            emergencyContacts.filter((x) => x.id !== id)
                          );
                        }}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: C.pl,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Ic n="x" s={16} c={C.p} />
                      </button>
                    )}
                  </div>
                </div>
              </Cd>
            ))}
            <AddContactForm
              onAdd={(c) => setEmergencyContacts([...emergencyContacts, c])}
            />
          </>
        )}
    </div>
  );
}
