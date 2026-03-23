import React, { useEffect, useRef, useState } from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Pill from '@/components/shared/Pill';
import Card from '@/components/shared/Card';
import { today, autoSleepType } from '@/lib/utils/date';

interface TimerViewProps {
  logs: any;
  setLogs: (logs: any) => void;
  age: number;
  timerState: any;
  setTimerState: (state: any) => void;
}

export default function TimerView({
  logs,
  setLogs,
  age,
  timerState,
  setTimerState,
}: TimerViewProps) {
  const [elapsed, setElapsed] = useState(
    timerState.running && timerState.startTime
      ? Math.floor((Date.now() - timerState.startTime) / 1000)
      : 0
  );
  const [timerType, setTimerType] = useState<string>(timerState.type || 'Breast L');
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const running = timerState.running;
  const startTime = timerState.startTime;

  useEffect(() => {
    if (running && startTime) {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      if (diff > 14400) {
        resetTimer();
        // toast("Timer auto-reset (exceeded 4 hrs)");
        return;
      }
      setElapsed(diff);
      intRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (intRef.current) clearInterval(intRef.current);
    };
  }, [running, startTime]);

  function startTimer() {
    const st = Date.now();
    setTimerState({ running: true, type: timerType, startTime: st });
    setElapsed(0);
  }

  function stopTimer() {
    if (intRef.current) clearInterval(intRef.current);
    setTimerState({ running: false, type: timerType, startTime: startTime });
  }

  function resetTimer() {
    if (intRef.current) clearInterval(intRef.current);
    setElapsed(0);
    setTimerState({ running: false, type: null, startTime: null });
  }

  function saveToLog() {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const dur = mins + 'm ' + secs + 's';
    const totalMins = Math.round((elapsed / 60) * 10) / 10;
    const resolvedType = timerType === 'Sleep' ? autoSleepType() : timerType;
    const isSleep = ['Nap', 'Night Sleep', 'Sleep', 'Tummy Time'].includes(timerType);
    const entry = {
      date: today(),
      time: new Date().toTimeString().slice(0, 5),
      id: Date.now(),
      type: resolvedType,
      amount: dur,
      mins: totalMins,
      notes: 'Timed',
    };
    const logKey = isSleep ? 'sleep' : 'feed';
    const next = Object.assign({}, logs);
    next[logKey] = [entry].concat(next[logKey] || []);
    setLogs(next);
    resetTimer();
    // toast("Saved "+dur+"!");
  }

  const mm = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0');
  const ss = (elapsed % 60).toString().padStart(2, '0');
  let ttToday = 0;
  (logs.sleep || [])
    .filter((e: any) => e.date === today() && e.type === 'Tummy Time')
    .forEach((e: any) => {
      if (!e.amount) return;
      const a = e.amount;
      let m = 0;
      const mm = /(\d+)\s*m/.exec(a);
      const sm = /(\d+)\s*s/.exec(a);
      if (mm) m += parseInt(mm[1]);
      if (sm) m += parseInt(sm[1]) / 60;
      if (m === 0) m = parseInt(a) || 0;
      ttToday += m;
    });

  const ttGoal = age < 3 ? 15 : age < 6 ? 30 : 45;
  const types = ['Breast L', 'Breast R', 'Formula', 'Pumped Milk', 'Sleep', 'Tummy Time'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {types.map((t) => (
          <Pill
            key={t}
            label={t}
            active={timerType === t}
            onClick={() => {
              if (!running) setTimerType(t);
            }}
            color={C.s}
          />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 90,
            border: '6px solid ' + (running ? C.p : C.b),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            background: C.cd,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: C.t,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {mm}:{ss}
            </div>
            <div style={{ fontSize: 13, color: C.tl }}>{timerType || 'Select type'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
        {!running ? (
          <Button label="Start" onClick={startTimer} color={C.ok} />
        ) : (
          <Button label="Stop" onClick={stopTimer} color={C.p} />
        )}
        {elapsed > 0 && !running && <Button label="Save to Log" onClick={saveToLog} color={C.s} />}
        {elapsed > 0 && <Button label="Reset" onClick={resetTimer} color={C.tl} outline />}
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>Tummy Time Today</div>
          <div style={{ fontSize: 13, color: C.tl }}>
            {ttToday} / {ttGoal} min
          </div>
        </div>
        <div style={{ background: C.b, borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div
            style={{
              background: C.a,
              height: '100%',
              borderRadius: 6,
              width: Math.min((ttToday / ttGoal) * 100, 100) + '%',
              transition: 'width 0.3s',
            }}
          />
        </div>
      </Card>
    </div>
  );
}
