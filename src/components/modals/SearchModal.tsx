import React, { useMemo, useState } from 'react';
import { C } from '@/lib/constants/colors';
import Icon from '@/components/shared/Icon';
import Card from '@/components/shared/Card';
import { fmtDate, fmtTime } from '@/lib/utils/date';
import { MILESTONES } from '@/lib/constants/milestones';

interface SearchResult {
  cat: string;
  text: string;
  date?: string;
  time?: string;
  nav?: { tab: string; sub: string };
}

interface SearchModalProps {
  onClose: () => void;
  logs: any;
  firsts: any[];
  checked: any;
  onNav: (tab: string, sub: string) => void;
}

export default function SearchModal({
  onClose,
  logs,
  firsts,
  checked,
  onNav,
}: SearchModalProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const res: SearchResult[] = [];

    // Search logs — all log categories that exist in the data
    const logTypes = ['feed', 'diaper', 'sleep', 'tummy', 'growth', 'temp', 'bath', 'massage', 'meds', 'allergy'];
    logTypes.forEach((type) => {
      (logs[type] || []).forEach((e: any) => {
        const text = [e.type, e.subType, e.amount, e.notes, e.food, e.reaction, e.med, e.dose, e.weight, e.height, e.head, e.temp, e.duration, e.waterTemp, e.color, e.consistency, e.peeAmount, e.side]
          .filter(Boolean)
          .join(' ');
        if (text.toLowerCase().indexOf(q) >= 0) {
          res.push({
            cat: 'Log: ' + type.charAt(0).toUpperCase() + type.slice(1),
            text: text,
            date: e.date,
            time: e.time,
            nav: { tab: 'log', sub: type },
          });
        }
      });
    });

    // Search firsts
    (firsts || []).forEach((f: any) => {
      const text = [f.title, f.notes].filter(Boolean).join(' ');
      if (text.toLowerCase().indexOf(q) >= 0) {
        res.push({
          cat: 'First',
          text: f.title + (f.notes ? ' — ' + f.notes : ''),
          date: f.date,
          nav: { tab: 'miles', sub: 'firsts' },
        });
      }
    });

    // Search milestones
    Object.entries(MILESTONES).forEach(([monthKey, m]: [string, any]) => {
      const allItems = [...(m.motor || []), ...(m.cog || []), ...(m.soc || []), ...(m.lang || [])];
      allItems.forEach((item: string) => {
        if (item.toLowerCase().indexOf(q) >= 0) {
          res.push({
            cat: 'Milestone: ' + (m.l || monthKey + ' mo'),
            text: item,
            nav: { tab: 'miles', sub: 'milestones' },
          });
        }
      });
      // Also search red flags
      (m.red || []).forEach((flag: string) => {
        if (flag.toLowerCase().indexOf(q) >= 0) {
          res.push({
            cat: 'Red Flag: ' + (m.l || monthKey + ' mo'),
            text: flag,
            nav: { tab: 'miles', sub: 'milestones' },
          });
        }
      });
    });

    return res.slice(0, 50);
  }, [query, logs, firsts]);

  return (
    <div
      className="mo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ alignItems: 'flex-start', paddingTop: 40 }}
    >
      <div className="ms" style={{ borderRadius: 20, maxHeight: '85vh' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Icon n="search" s={20} c={C.s} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything..."
            autoFocus
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1.5px solid ' + C.b,
              fontSize: 16,
              color: C.t,
              background: C.bg,
              outline: 'none',
            }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon n="x" s={22} c={C.tl} />
          </button>
        </div>

        {query.length < 2 ? (
          <div style={{ textAlign: 'center', padding: 30, color: C.tl }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div>Type at least 2 characters to search</div>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: C.tl }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
            <div>No results found</div>
          </div>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: C.tl, marginBottom: 8 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            {results.map((r, i) => (
              <div
                key={i}
                onClick={
                  r.nav
                    ? () => {
                        onNav(r.nav!.tab, r.nav!.sub);
                        onClose();
                      }
                    : undefined
                }
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid ' + C.b,
                  marginBottom: 2,
                  cursor: r.nav ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.s, marginBottom: 2 }}>{r.cat}</div>
                  {r.nav && <Icon n="chevron-right" s={14} c={C.tl} />}
                </div>
                <div style={{ fontSize: 13, color: C.t, lineHeight: 1.4 }}>{r.text}</div>
                {r.date && (
                  <div style={{ fontSize: 11, color: C.tl, marginTop: 2 }}>
                    {fmtDate(r.date)}
                    {r.time ? ' ' + fmtTime(r.time) : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
