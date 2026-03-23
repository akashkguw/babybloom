import React, { useState, useEffect } from 'react';
import {
  Card as Cd,
  SectionHeader as SH,
  Button as Btn,
  Pill,
  Input,
  Icon as Ic,
} from '@/components/shared';
import { fmtVol, volLabel, mlToOz, ozToMl } from '@/lib/utils/volume';
import { today, now, fmtTime, fmtDate } from '@/lib/utils/date';
import { C } from '@/lib/constants/colors';
import { toast } from '@/lib/utils/toast';
import TimerView from '@/features/feeding/TimerView';
import StatsView from '@/features/stats/StatsView';

interface LogEntry {
  id: number | string;
  date: string;
  time: string;
  type?: string;
  amount?: string;
  oz?: number;
  mins?: number;
  sleepHrs?: string;
  sleepMins?: string;
  notes?: string;
  weight?: string;
  height?: string;
  head?: string;
  temp?: string;
  color?: string;
  consistency?: string;
  peeAmount?: string;
  duration?: string | number;
  med?: string;
  dose?: string;
  food?: string;
  reaction?: string;
  waterTemp?: string;
  oil?: string;
  mood?: string;
  pumpOz?: number;
  feedMins?: string;
  feedOz?: string;
  autoSleep?: string;
}

interface FormData {
  time?: string;
  type?: string;
  amount?: string;
  feedVal?: string;
  feedMins?: string;
  feedOz?: string;
  oz?: number;
  pumpVal?: string;
  pumpOz?: number;
  color?: string;
  consistency?: string;
  peeAmount?: string;
  sleepHrs?: string;
  sleepMins?: string;
  mins?: number;
  autoSleep?: string;
  weight?: string;
  height?: string;
  head?: string;
  temp?: string;
  med?: string;
  dose?: string;
  food?: string;
  reaction?: string;
  duration?: string | number;
  waterTemp?: string;
  oil?: string;
  mood?: string;
  notes?: string;
}

interface SubTab {
  id: string;
  l: string;
  e: string;
}

interface LogTabProps {
  logs: Record<string, LogEntry[]>;
  setLogs: (logs: Record<string, LogEntry[]>) => void;
  age: number;
  subNavRef?: React.MutableRefObject<string | null>;
  quickFormRef?: React.MutableRefObject<FormData | null>;
  timerState?: { running: boolean; type: string | null; startTime: number | null };
  setTimerState?: (state: { running: boolean; type: string | null; startTime: number | null }) => void;
  volumeUnit: 'oz' | 'ml';
}

const LogTab: React.FC<LogTabProps> = ({
  logs,
  setLogs,
  age,
  subNavRef,
  quickFormRef,
  timerState,
  setTimerState,
  volumeUnit,
}) => {
  const [sub, setSub] = useState<string>(
    (subNavRef?.current || 'feed') as string
  );
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormData>({});
  const [editId, setEditId] = useState<number | string | null>(null);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const td = today();

  // Handle subNavRef on mount
  useEffect(() => {
    if (subNavRef?.current) {
      setSub(subNavRef.current);
      subNavRef.current = null;
    }
  }, [subNavRef]);

  // Handle quickFormRef on mount
  useEffect(() => {
    if (quickFormRef?.current) {
      setForm(quickFormRef.current);
      setShowAdd(true);
      quickFormRef.current = null;
    }
  }, [quickFormRef]);

  const subs: SubTab[] = [
    { id: 'timer', l: 'Timer', e: '⏱️' },
    { id: 'feed', l: 'Feed', e: '🍼' },
    { id: 'pump', l: 'Pump', e: '🫙' },
    { id: 'diaper', l: 'Diaper', e: '💧' },
    { id: 'sleep', l: 'Sleep', e: '😴' },
    { id: 'bath', l: 'Bath', e: '🛁' },
    { id: 'massage', l: 'Massage', e: '🤲' },
    { id: 'growth', l: 'Growth', e: '📏' },
    { id: 'temp', l: 'Temp', e: '🌡️' },
    { id: 'meds', l: 'Meds', e: '💊' },
    { id: 'allergy', l: 'Allergy', e: '⚠️' },
    { id: 'stats', l: 'Stats', e: '📊' },
  ];

  const items = (logs[sub] || []).filter((x) => x.date === td);
  const allItems = logs[sub] || [];

  const logColors: Record<string, string> = {
    feed: C.a,
    pump: C.a,
    diaper: C.bl,
    sleep: C.pu,
    bath: C.bl,
    massage: C.pu,
    growth: C.p,
    temp: C.w,
    meds: C.s,
    allergy: C.p,
  };

  function addEntry() {
    const entry: LogEntry = {
      date: td,
      time: form.time || now(),
      id: editId || Date.now(),
      ...form,
    };

    // Auto-compute sleep duration for Wake Up if not already set
    if (sub === 'sleep' && entry.type === 'Wake Up' && !entry.mins) {
      const sl = (logs.sleep || []).filter(
        (e) => e.type === 'Nap' || e.type === 'Night Sleep'
      );
      if (sl.length > 0 && sl[0].time && entry.time) {
        const wP = (entry.time || '').split(':');
        const sP = sl[0].time.split(':');
        const wM = parseInt(wP[0]) * 60 + parseInt(wP[1]);
        const sM = parseInt(sP[0]) * 60 + parseInt(sP[1]);
        let df = wM - sM;
        if (df < 0) df += 1440;
        if (df > 0 && df < 1440) {
          const hrs2 = Math.floor(df / 60);
          const mins2 = df % 60;
          entry.mins = df;
          entry.amount =
            (hrs2 > 0 ? hrs2 + 'h ' : '') + (mins2 > 0 ? mins2 + 'm' : '0m');
          entry.sleepHrs = String(hrs2);
          entry.sleepMins = String(mins2);
        }
      }
    }

    const cur = logs[sub] || [];
    const next = { ...logs };

    if (editId) {
      next[sub] = cur.map((x) => (x.id === editId ? entry : x));
      setEditId(null);
    } else {
      next[sub] = [entry, ...cur];
    }

    setLogs(next);
    setShowAdd(false);
    setForm({});
    toast(
      (editId ? 'Updated!' : 'Logged!') +
        (sub === 'sleep' &&
        entry.type === 'Wake Up' &&
        entry.mins
          ? ' (' + entry.amount + ' sleep)'
          : '')
    );
  }

  function removeEntry(id: number | string) {
    const next = { ...logs };
    next[sub] = (logs[sub] || []).filter((x) => x.id !== id);
    setLogs(next);
    toast('Removed');
  }

  function handleEditClick(entry: LogEntry) {
    const e: Record<string, any> = { ...entry };
    if (sub === 'sleep' && typeof e.mins === 'number') {
      e.sleepHrs = String(Math.floor(e.mins / 60));
      e.sleepMins = String(Math.round(e.mins % 60));
    }
    if (sub === 'feed') {
      if (e.mins && !e.oz) e.feedMins = String(e.mins);
      if (e.oz) {
        e.feedOz = String(e.oz);
        e.feedVal = String(
          volumeUnit === 'ml' ? Math.round(ozToMl(e.oz)) : e.oz
        );
      }
    }
    if (sub === 'pump' && e.pumpOz) {
      e.pumpVal = String(
        volumeUnit === 'ml' ? Math.round(ozToMl(e.pumpOz)) : e.pumpOz
      );
    }
    setForm(e as FormData);
    setEditId(entry.id);
    setShowAdd(true);
  }

  return (
    <div className="ca" style={{ padding: '16px 16px 120px' }}>
      <SH
        icon="edit"
        title="Daily Log"
        color={C.s}
        sub="Track feeding, diapers, sleep & more"
      />

      {/* Sub tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 12,
          marginBottom: 12,
        }}
      >
        {subs.map((s) => (
          <Pill
            key={s.id}
            label={s.e + ' ' + s.l}
            active={sub === s.id}
            onClick={() => setSub(s.id)}
            color={C.s}
          />
        ))}
      </div>

      {/* Timer View */}
      {sub === 'timer' && timerState !== undefined && setTimerState ? (
        <TimerView
          logs={logs}
          setLogs={setLogs}
          age={age}
          timerState={timerState}
          setTimerState={setTimerState}
        />
      ) : null}

      {/* Stats View */}
      {sub === 'stats' ? (
        <StatsView
          logs={logs}
          period={period}
          setPeriod={setPeriod}
          logColors={logColors}
          volumeUnit={volumeUnit}
        />
      ) : null}

      {/* Add button (hidden in stats and timer view) */}
      {sub !== 'stats' && sub !== 'timer' ? (
        <Btn
          label="+ Add Entry"
          onClick={() => {
            setForm({});
            setShowAdd(true);
          }}
          color={C.s}
          full={true}
        />
      ) : null}

      {/* Today's entries (hidden in stats and timer view) */}
      {sub !== 'stats' && sub !== 'timer' ? (
        <>
          <div
            style={{
              marginTop: 16,
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 600,
              color: C.tl,
            }}
          >
            Today — {fmtDate(td)} ({items.length} entries)
          </div>

          {items.length === 0 ? (
            <Cd style={{ textAlign: 'center', padding: 30, color: C.tl }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {(subs.find((s) => s.id === sub) || { e: '📝' }).e}
              </div>
              <div>No entries yet today</div>
            </Cd>
          ) : (
            items.map((entry) => (
              <Cd
                key={entry.id}
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
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: C.t,
                      }}
                    >
                      {fmtTime(entry.time)}
                      {entry.type ? ' — ' + entry.type : ''}
                      {entry.oz
                        ? ' — ' + fmtVol(entry.oz, volumeUnit)
                        : entry.amount
                          ? ' — ' + entry.amount
                          : ''}
                    </div>
                    {entry.notes ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: C.tl,
                          marginTop: 2,
                        }}
                      >
                        {entry.notes}
                      </div>
                    ) : null}
                    {entry.weight ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Weight: {entry.weight} lbs
                      </div>
                    ) : null}
                    {entry.height ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Height: {entry.height} in
                      </div>
                    ) : null}
                    {entry.temp ? (
                      <div
                        style={{
                          fontSize: 13,
                          color:
                            parseFloat(entry.temp) >= 100.4 ? C.p : C.t,
                        }}
                      >
                        Temp: {entry.temp}°F
                      </div>
                    ) : null}
                    {entry.food ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Food: {entry.food}
                      </div>
                    ) : null}
                    {entry.reaction ? (
                      <div style={{ fontSize: 13, color: C.p }}>
                        Reaction: {entry.reaction}
                      </div>
                    ) : null}
                    {entry.med ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        {entry.med}
                        {entry.dose ? ' ' + entry.dose : ''}
                      </div>
                    ) : null}
                    {entry.color ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Color: {entry.color}
                      </div>
                    ) : null}
                    {entry.consistency ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Consistency: {entry.consistency}
                      </div>
                    ) : null}
                    {entry.peeAmount ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Pee: {entry.peeAmount}
                      </div>
                    ) : null}
                    {entry.duration ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Duration: {entry.duration} min
                      </div>
                    ) : null}
                    {entry.waterTemp ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Water: {entry.waterTemp}
                      </div>
                    ) : null}
                    {entry.oil ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Oil: {entry.oil}
                      </div>
                    ) : null}
                    {entry.mood ? (
                      <div style={{ fontSize: 13, color: C.t }}>
                        Mood: {entry.mood}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleEditClick(entry)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <Ic n="edit" s={14} c={C.bl} />
                    </button>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <Ic n="x" s={16} c={C.tl} />
                    </button>
                  </div>
                </div>
              </Cd>
            ))
          )}

          {allItems.length > items.length ? (
            <div
              style={{
                textAlign: 'center',
                padding: 12,
                fontSize: 12,
                color: C.tl,
              }}
            >
              {allItems.length} total entries
            </div>
          ) : null}
        </>
      ) : null}

      {/* Add Modal */}
      {showAdd ? (
        <div
          className="mo"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAdd(false);
              setEditId(null);
            }
          }}
        >
          <div className="ms">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t }}>
                {editId ? 'Edit' : 'Log'}{' '}
                {(subs.find((s) => s.id === sub) || { l: sub }).l}
              </h3>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setEditId(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <Ic n="x" s={22} c={C.tl} />
              </button>
            </div>

            {/* Time */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.tl,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Time
              </label>
              <Input
                type="time"
                value={form.time || now()}
                onChange={(v) => {
                  // If Wake Up, recalc duration when time changes
                  if (sub === 'sleep' && form.type === 'Wake Up') {
                    const sl = (logs.sleep || []).filter(
                      (e) => e.type === 'Nap' || e.type === 'Night Sleep'
                    );
                    if (sl.length > 0 && sl[0].time) {
                      const wP = v.split(':');
                      const sP = sl[0].time.split(':');
                      const wM = parseInt(wP[0]) * 60 + parseInt(wP[1]);
                      const sM = parseInt(sP[0]) * 60 + parseInt(sP[1]);
                      let df = wM - sM;
                      if (df < 0) df += 1440;
                      if (df > 0 && df < 1440) {
                        const hrs2 = Math.floor(df / 60);
                        const mins2 = df % 60;
                        setForm({
                          ...form,
                          time: v,
                          sleepHrs: String(hrs2),
                          sleepMins: String(mins2),
                          amount:
                            (hrs2 > 0 ? hrs2 + 'h ' : '') +
                            (mins2 > 0 ? mins2 + 'm' : '0m'),
                          mins: df,
                          autoSleep:
                            sl[0].type + ' at ' + fmtTime(sl[0].time),
                        });
                        return;
                      }
                    }
                  }
                  setForm({ ...form, time: v });
                }}
              />
            </div>

            {/* Feed specific */}
            {sub === 'feed' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Type
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['Breast L', 'Breast R', 'Formula', 'Pumped Milk', 'Solids'].map(
                      (t) => (
                        <Pill
                          key={t}
                          label={t}
                          active={form.type === t}
                          onClick={() =>
                            setForm({ ...form, type: t })
                          }
                          color={C.a}
                        />
                      )
                    )}
                  </div>
                </div>

                {form.type === 'Breast L' || form.type === 'Breast R' ? (
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.tl,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Duration (minutes)
                    </label>
                    <Input
                      type="number"
                      value={form.feedMins || ''}
                      onChange={(v) => {
                        const m = parseInt(v) || 0;
                        setForm({
                          ...form,
                          feedMins: v,
                          amount: m + ' min',
                          mins: m,
                        });
                      }}
                      placeholder="e.g. 15"
                    />
                  </div>
                ) : form.type === 'Formula' ||
                  form.type === 'Pumped Milk' ||
                  form.type === 'Bottle' ? (
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.tl,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Amount ({volLabel(volumeUnit)})
                    </label>
                    <Input
                      type="number"
                      value={form.feedVal || ''}
                      onChange={(v) => {
                        const num = parseFloat(v) || 0;
                        const ozVal =
                          volumeUnit === 'ml' ? mlToOz(num) : num;
                        setForm({
                          ...form,
                          feedVal: v,
                          feedOz: String(ozVal),
                          amount: v + ' ' + volLabel(volumeUnit),
                          oz: ozVal,
                        });
                      }}
                      placeholder={
                        volumeUnit === 'ml' ? 'e.g. 120' : 'e.g. 4'
                      }
                    />
                  </div>
                ) : form.type === 'Solids' ? (
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.tl,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Food / Description
                    </label>
                    <Input
                      value={form.amount || ''}
                      onChange={(v) =>
                        setForm({ ...form, amount: v })
                      }
                      placeholder="e.g. Sweet potato puree, 2 tbsp"
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {/* Pump specific */}
            {sub === 'pump' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Side
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Left', 'Right', 'Both'].map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={form.type === t}
                        onClick={() =>
                          setForm({ ...form, type: t })
                        }
                        color={C.a}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Amount ({volLabel(volumeUnit)})
                  </label>
                  <Input
                    type="number"
                    value={form.pumpVal || ''}
                    onChange={(v) => {
                      const num = parseFloat(v) || 0;
                      const ozVal = volumeUnit === 'ml' ? mlToOz(num) : num;
                      setForm({
                        ...form,
                        pumpVal: v,
                        amount: v + ' ' + volLabel(volumeUnit),
                        pumpOz: ozVal,
                      });
                    }}
                    placeholder={
                      volumeUnit === 'ml' ? 'e.g. 120' : 'e.g. 4'
                    }
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Duration (min)
                  </label>
                  <Input
                    type="number"
                    value={String(form.duration || '')}
                    onChange={(v) =>
                      setForm({ ...form, duration: v })
                    }
                    placeholder="e.g. 20"
                  />
                </div>
              </>
            ) : null}

            {/* Diaper specific */}
            {sub === 'diaper' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Type
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Wet', 'Dirty', 'Both'].map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={form.type === t}
                        onClick={() =>
                          setForm({ ...form, type: t })
                        }
                        color={C.bl}
                      />
                    ))}
                  </div>
                </div>

                {form.type && form.type !== 'Wet' ? (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.tl,
                          display: 'block',
                          marginBottom: 4,
                        }}
                      >
                        Color
                      </label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['Yellow', 'Green', 'Brown', 'Black', 'Red/Blood'].map(
                          (t) => (
                            <Pill
                              key={t}
                              label={t}
                              active={form.color === t}
                              onClick={() =>
                                setForm({ ...form, color: t })
                              }
                              color={t === 'Red/Blood' ? C.p : C.w}
                            />
                          )
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.tl,
                          display: 'block',
                          marginBottom: 4,
                        }}
                      >
                        Consistency
                      </label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['Runny', 'Soft', 'Formed', 'Hard', 'Mucousy'].map(
                          (t) => (
                            <Pill
                              key={t}
                              label={t}
                              active={form.consistency === t}
                              onClick={() =>
                                setForm({ ...form, consistency: t })
                              }
                              color={C.bl}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </>
                ) : null}

                {form.type === 'Wet' || form.type === 'Both' ? (
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.tl,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Pee Amount
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Light', 'Normal', 'Heavy'].map((t) => (
                        <Pill
                          key={t}
                          label={t}
                          active={form.peeAmount === t}
                          onClick={() =>
                            setForm({ ...form, peeAmount: t })
                          }
                          color={C.bl}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* Sleep specific */}
            {sub === 'sleep' ? (
              (() => {
                // Find last sleep entry for auto-calc on Wake Up
                let lastSleep: LogEntry | null = null;
                if (form.type === 'Wake Up' || form.type === 'Tummy Time') {
                  const sleepEntries = (logs.sleep || []).filter(
                    (e) => e.type === 'Nap' || e.type === 'Night Sleep'
                  );
                  if (sleepEntries.length > 0) {
                    lastSleep = sleepEntries[0];
                  }
                }

                // Compute auto duration for display
                let autoMins: number | null = null;
                if (form.type === 'Wake Up' && lastSleep && lastSleep.time) {
                  const wt = form.time || now();
                  const st = lastSleep.time;
                  const wP = wt.split(':');
                  const sP = st.split(':');
                  const wM = parseInt(wP[0]) * 60 + parseInt(wP[1]);
                  const sM = parseInt(sP[0]) * 60 + parseInt(sP[1]);
                  let df = wM - sM;
                  if (df < 0) df += 1440;
                  if (df > 0 && df < 1440) autoMins = df;
                }

                return (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.tl,
                          display: 'block',
                          marginBottom: 4,
                        }}
                      >
                        Type
                      </label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['Nap', 'Night Sleep', 'Wake Up', 'Tummy Time'].map(
                          (t) => (
                            <Pill
                              key={t}
                              label={t}
                              active={form.type === t}
                              onClick={() => {
                                if (t === 'Wake Up') {
                                  // Auto-calc from last sleep entry
                                  const sl = (logs.sleep || []).filter(
                                    (e) =>
                                      e.type === 'Nap' ||
                                      e.type === 'Night Sleep'
                                  );
                                  if (sl.length > 0 && sl[0].time) {
                                    const wt2 = form.time || now();
                                    const st2 = sl[0].time;
                                    const wP2 = wt2.split(':');
                                    const sP2 = st2.split(':');
                                    const wM2 =
                                      parseInt(wP2[0]) * 60 +
                                      parseInt(wP2[1]);
                                    const sM2 =
                                      parseInt(sP2[0]) * 60 +
                                      parseInt(sP2[1]);
                                    let df2 = wM2 - sM2;
                                    if (df2 < 0) df2 += 1440;
                                    if (df2 > 0 && df2 < 1440) {
                                      const hrs2 = Math.floor(df2 / 60);
                                      const mins2 = df2 % 60;
                                      setForm({
                                        ...form,
                                        type: t,
                                        sleepHrs: String(hrs2),
                                        sleepMins: String(mins2),
                                        amount:
                                          (hrs2 > 0 ? hrs2 + 'h ' : '') +
                                          (mins2 > 0 ? mins2 + 'm' : '0m'),
                                        mins: df2,
                                        autoSleep:
                                          sl[0].type +
                                          ' at ' +
                                          fmtTime(sl[0].time),
                                      });
                                      return;
                                    }
                                  }
                                  setForm({
                                    ...form,
                                    type: t,
                                    sleepHrs: '',
                                    sleepMins: '',
                                    amount: '',
                                    mins: 0,
                                    autoSleep: '',
                                  });
                                } else {
                                  setForm({
                                    ...form,
                                    type: t,
                                    sleepHrs: '',
                                    sleepMins: '',
                                    amount: '',
                                    mins: 0,
                                    autoSleep: '',
                                  });
                                }
                              }}
                              color={C.pu}
                            />
                          )
                        )}
                      </div>
                    </div>

                    {form.type === 'Nap' || form.type === 'Night Sleep' ? (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: 12,
                          background: C.pul,
                          borderRadius: 12,
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            color: C.pu,
                            fontWeight: 600,
                          }}
                        >
                          Recording: baby fell asleep
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: C.tl,
                            marginTop: 4,
                          }}
                        >
                          Log "Wake Up" later to auto-calculate sleep
                          duration
                        </div>
                      </div>
                    ) : null}

                    {form.type === 'Wake Up' ? (
                      <>
                        {form.autoSleep ? (
                          <div
                            style={{
                              marginBottom: 12,
                              padding: 14,
                              background: C.pul,
                              borderRadius: 12,
                              textAlign: 'center',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: C.tl,
                                marginBottom: 4,
                              }}
                            >
                              Since: {form.autoSleep}
                            </div>
                            <div
                              style={{
                                fontSize: 28,
                                fontWeight: 800,
                                color: C.pu,
                              }}
                            >
                              {form.sleepHrs || '0'}h {form.sleepMins || '0'}m
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: C.tl,
                                marginTop: 4,
                              }}
                            >
                              Baby slept
                            </div>
                          </div>
                        ) : !lastSleep ? (
                          <div
                            style={{
                              marginBottom: 12,
                              padding: 12,
                              background: C.wl,
                              borderRadius: 12,
                              textAlign: 'center',
                              fontSize: 12,
                              color: C.w,
                            }}
                          >
                            No previous sleep entry found — enter duration
                            manually below
                          </div>
                        ) : null}

                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: C.tl,
                            marginBottom: 6,
                          }}
                        >
                          {form.autoSleep ? 'Adjust if needed:' : 'Duration:'}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <label
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: C.tl,
                                display: 'block',
                                marginBottom: 4,
                              }}
                            >
                              Hours
                            </label>
                            <Input
                              type="number"
                              value={form.sleepHrs || ''}
                              onChange={(v) => {
                                const hrs = parseInt(v) || 0;
                                const m2 = parseInt(form.sleepMins || '0') || 0;
                                const total = hrs * 60 + m2;
                                setForm({
                                  ...form,
                                  sleepHrs: v,
                                  amount:
                                    (hrs > 0 ? hrs + 'h ' : '') +
                                    (m2 > 0 ? m2 + 'm' : '0m'),
                                  mins: total,
                                });
                              }}
                              placeholder="0"
                            />
                          </div>

                          <div style={{ flex: 1 }}>
                            <label
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: C.tl,
                                display: 'block',
                                marginBottom: 4,
                              }}
                            >
                              Minutes
                            </label>
                            <Input
                              type="number"
                              value={form.sleepMins || ''}
                              onChange={(v) => {
                                const hrs =
                                  parseInt(form.sleepHrs || '0') || 0;
                                const m2 = parseInt(v) || 0;
                                const total = hrs * 60 + m2;
                                setForm({
                                  ...form,
                                  sleepMins: v,
                                  amount:
                                    (hrs > 0 ? hrs + 'h ' : '') +
                                    (m2 > 0 ? m2 + 'm' : '0m'),
                                  mins: total,
                                });
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    {form.type === 'Tummy Time' ? (
                      <div style={{ marginBottom: 12 }}>
                        <label
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: C.tl,
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          Duration (minutes)
                        </label>
                        <Input
                          type="number"
                          value={form.sleepMins || ''}
                          onChange={(v) => {
                            const m = parseInt(v) || 0;
                            setForm({
                              ...form,
                              sleepMins: v,
                              sleepHrs: '0',
                              amount: m + ' min',
                              mins: m,
                            });
                          }}
                          placeholder="e.g. 10"
                        />
                      </div>
                    ) : null}
                  </>
                );
              })()
            ) : null}

            {/* Growth specific */}
            {sub === 'growth' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Weight (lbs)
                  </label>
                  <Input
                    type="number"
                    value={form.weight || ''}
                    onChange={(v) =>
                      setForm({ ...form, weight: v })
                    }
                    placeholder="e.g. 14.5"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Height (inches)
                  </label>
                  <Input
                    type="number"
                    value={form.height || ''}
                    onChange={(v) =>
                      setForm({ ...form, height: v })
                    }
                    placeholder="e.g. 26"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Head Circ. (inches)
                  </label>
                  <Input
                    type="number"
                    value={form.head || ''}
                    onChange={(v) =>
                      setForm({ ...form, head: v })
                    }
                    placeholder="e.g. 16"
                  />
                </div>
              </>
            ) : null}

            {/* Temp specific */}
            {sub === 'temp' ? (
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.tl,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Temperature (°F)
                </label>
                <Input
                  type="number"
                  value={form.temp || ''}
                  onChange={(v) =>
                    setForm({ ...form, temp: v })
                  }
                  placeholder="e.g. 99.5"
                />
              </div>
            ) : null}

            {/* Meds specific */}
            {sub === 'meds' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Medication
                  </label>
                  <Input
                    value={form.med || ''}
                    onChange={(v) =>
                      setForm({ ...form, med: v })
                    }
                    placeholder="e.g. Infant Tylenol"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Dose
                  </label>
                  <Input
                    value={form.dose || ''}
                    onChange={(v) =>
                      setForm({ ...form, dose: v })
                    }
                    placeholder="e.g. 2.5 mL"
                  />
                </div>
              </>
            ) : null}

            {/* Allergy specific */}
            {sub === 'allergy' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Food Introduced
                  </label>
                  <Input
                    value={form.food || ''}
                    onChange={(v) =>
                      setForm({ ...form, food: v })
                    }
                    placeholder="e.g. Peanut butter"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Reaction (if any)
                  </label>
                  <Input
                    value={form.reaction || ''}
                    onChange={(v) =>
                      setForm({ ...form, reaction: v })
                    }
                    placeholder="e.g. None / Rash on face"
                  />
                </div>
              </>
            ) : null}

            {/* Bath specific */}
            {sub === 'bath' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Type
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Full Bath', 'Sponge Bath', 'Hair Wash'].map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={form.type === t}
                        onClick={() =>
                          setForm({ ...form, type: t })
                        }
                        color={C.a}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Water Temp
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Warm', 'Lukewarm', 'Cool'].map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={form.waterTemp === t}
                        onClick={() =>
                          setForm({ ...form, waterTemp: t })
                        }
                        color={C.bl}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {/* Massage specific */}
            {sub === 'massage' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Type
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {[
                      'Full Body',
                      'Legs & Feet',
                      'Tummy',
                      'Back',
                      'Arms',
                      'Face & Head',
                    ].map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={form.type === t}
                        onClick={() =>
                          setForm({ ...form, type: t })
                        }
                        color={C.pu}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Oil Used
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {[
                      'Coconut',
                      'Sesame',
                      'Olive',
                      'Almond',
                      'Sunflower',
                      'None',
                    ].map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={form.oil === t}
                        onClick={() =>
                          setForm({ ...form, oil: t })
                        }
                        color={C.a}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Duration (minutes)
                  </label>
                  <Input
                    type="number"
                    value={String(form.duration || '')}
                    onChange={(v) =>
                      setForm({ ...form, duration: v })
                    }
                    placeholder="e.g. 10"
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.tl,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Baby's Mood
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Calm', 'Happy', 'Fussy', 'Sleepy'].map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={form.mood === t}
                        onClick={() =>
                          setForm({ ...form, mood: t })
                        }
                        color={C.s}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {/* Notes (all) */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.tl,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Notes
              </label>
              <Input
                value={form.notes || ''}
                onChange={(v) =>
                  setForm({ ...form, notes: v })
                }
                placeholder="Optional notes"
              />
            </div>

            <Btn
              label={editId ? 'Update Entry' : 'Save Entry'}
              onClick={addEntry}
              color={C.s}
              full={true}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LogTab;
