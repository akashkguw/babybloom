import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { dg, ds } from '@/lib/db';
import { today, now, fmtTime, fmtDate } from '@/lib/utils/date';
import { fmtVol, volLabel, ozToMl, mlToOz } from '@/lib/utils/volume';
import { MILESTONES, TEETH_ORDER } from '@/lib/constants/milestones';
import { C, applyTheme } from '@/lib/constants/colors';
import HomeTab from '@/tabs/HomeTab';
import LogTab from '@/tabs/LogTab';
import MilestonesTab from '@/tabs/MilestonesTab';
import GuideTab from '@/tabs/GuideTab';
import SafetyTab from '@/tabs/SafetyTab';
import TabBar from '@/components/shared/TabBar';
import Settings from '@/features/settings/Settings';
import SearchModal from '@/components/modals/SearchModal';
import { Icon as Ic } from '@/components/shared/Icon';
import { toast } from '@/lib/utils/toast';

interface Profile {
  id: number;
  name: string;
  birthDate?: string;
}

interface EmergencyContact {
  id: number;
  name: string;
  phone: string;
  role: string;
}

interface Reminders {
  feedInterval: number;
  enabled: boolean;
}

interface TimerState {
  running: boolean;
  type: string | null;
  startTime: number | null;
}

interface FeedTimerApp {
  type: string;
  startTime: number;
  startTimeStr: string;
}

interface SiriResult {
  cat: string;
  type: string;
  amount: string;
  time: string;
}

function App() {
  const [tab, setTab] = useState<string>('home');
  const [birth, setBR] = useState<string | null>(null);
  const [selMo, setSelMo] = useState<number>(0);
  const [checked, setCkR] = useState<any>({});
  const [vDone, setVDR] = useState<any>({});
  const [logs, setLgR] = useState<any>({});
  const [teeth, setThR] = useState<any>({});
  const [firsts, setFiR] = useState<any[]>([]);
  const [emergencyContacts, setECR] = useState<EmergencyContact[]>([
    { id: 1, name: 'Emergency', phone: '911', role: 'Emergency' },
    { id: 2, name: 'Poison Control', phone: '1-800-222-1222', role: 'Poison Control' },
  ]);
  const [profiles, setProfilesR] = useState<Profile[]>([]);
  const [activeProfile, setActivePR] = useState<number | null>(null);
  const [showSet, setShowSet] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [darkMode, setDarkModeR] = useState<boolean>(false);
  const [timerState, setTSR] = useState<TimerState>({ running: false, type: null, startTime: null });
  const [reminders, setRemR] = useState<Reminders>({ feedInterval: 0, enabled: false });
  const [volumeUnit, setVUR] = useState<'ml' | 'oz'>('ml');
  const [feedTimerApp, _setFTA] = useState<FeedTimerApp | null>(null);
  const [siriResult, setSiriResult] = useState<SiriResult | null>(null);
  const [appTimerElapsed, setAppTimerElapsed] = useState(0);

  // Wrapper functions for persistence
  const setEmergencyContacts = (v: EmergencyContact[]) => {
    setECR(v);
    ds('emergencyContacts', v);
  };

  const setProfiles = (v: Profile[]) => {
    setProfilesR(v);
    ds('profiles', v);
  };

  const setActiveProfile = (v: number) => {
    setActivePR(v);
    ds('activeProfile', v);
  };

  const setDarkMode = (v: boolean) => {
    setDarkModeR(v);
    applyTheme(v);
    ds('darkMode', v);
  };

  const setTimerState = (v: TimerState) => {
    setTSR(v);
    ds('timerState', v);
  };

  const setReminders = (v: Reminders) => {
    setRemR(v);
    ds('reminders', v);
  };

  const setVolumeUnit = (v: 'ml' | 'oz') => {
    setVUR(v);
    ds('volumeUnit', v);
  };

  const setFeedTimerApp = (v: FeedTimerApp | null) => {
    _setFTA(v);
    ds('feedTimerApp', v);
  };

  const subNavRef = useRef<string | null>(null);
  const quickFormRef = useRef<any>(null);

  const navTo = (t: string, sub?: string, formData?: any) => {
    subNavRef.current = sub || null;
    quickFormRef.current = formData || null;
    setTab(t);
  };

  // Save field to both global and profile-specific keys
  const spd = (field: string, val: any) => {
    ds(field, val);
    if (activeProfile) {
      dg(`profileData_${activeProfile}`).then((d: any) => {
        const data = d || {};
        data[field] = val;
        ds(`profileData_${activeProfile}`, data);
      });
    }
  };

  const setBirth = (v: string) => {
    setBR(v);
    spd('birthDate', v);
    if (activeProfile) {
      const updated = profiles.map((p) =>
        p.id === activeProfile ? { ...p, birthDate: v } : p
      );
      setProfiles(updated);
    }
  };

  const setChecked = (fn: any) => {
    if (typeof fn === 'function') {
      setCkR((p: any) => {
        const n = fn(p);
        spd('milestones', n);
        return n;
      });
    } else {
      setCkR(fn);
      spd('milestones', fn);
    }
  };

  const setVDone = (fn: any) => {
    if (typeof fn === 'function') {
      setVDR((p: any) => {
        const n = fn(p);
        spd('vaccines', n);
        return n;
      });
    } else {
      setVDR(fn);
      spd('vaccines', fn);
    }
  };

  const setLogs = (v: any) => {
    setLgR(v);
    spd('logs', v);
  };

  const setTeeth = (fn: any) => {
    if (typeof fn === 'function') {
      setThR((p: any) => {
        const n = fn(p);
        spd('teeth', n);
        return n;
      });
    } else {
      setThR(fn);
      spd('teeth', fn);
    }
  };

  const setFirsts = (fn: any) => {
    if (typeof fn === 'function') {
      setFiR((p: any) => {
        const n = fn(p);
        spd('firsts', n);
        return n;
      });
    } else {
      setFiR(fn);
      spd('firsts', fn);
    }
  };

  // Profile data persistence
  const saveProfileData = (profileId: number | null) => {
    if (!profileId) return Promise.resolve();
    const data = { logs, milestones: checked, vaccines: vDone, teeth, firsts, birthDate: birth };
    return ds(`profileData_${profileId}`, data);
  };

  const loadProfileData = (profileId: number) => {
    return dg(`profileData_${profileId}`).then((data: any) => {
      if (data) {
        setLgR(data.logs || { feed: [], diaper: [], sleep: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
        setCkR(data.milestones || {});
        setVDR(data.vaccines || {});
        setThR(data.teeth || {});
        setFiR(data.firsts || []);
        if (data.birthDate) setBR(data.birthDate);
      } else {
        const prof = profiles.find((p) => p.id === profileId);
        setLgR({ feed: [], diaper: [], sleep: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
        setCkR({});
        setVDR({});
        setThR({});
        setFiR([]);
        if (prof && prof.birthDate) setBR(prof.birthDate);
      }
    });
  };

  const switchProfile = (newId: number) => {
    if (newId === activeProfile) return;
    saveProfileData(activeProfile).then(() => loadProfileData(newId)).then(() => {
      setActiveProfile(newId);
      toast('Switched profile!');
    });
  };

  const addProfile = (p: Profile) => {
    const newProfiles = profiles.concat([p]);
    setProfiles(newProfiles);
    toast('Profile added!');
  };

  const renameProfile = (id: number, newName: string) => {
    const updated = profiles.map((p) =>
      p.id === id ? { ...p, name: newName } : p
    );
    setProfiles(updated);
    toast('Name updated!');
  };

  const deleteProfile = (id: number) => {
    setProfiles(profiles.filter((x) => x.id !== id));
    ds(`profileData_${id}`, null);
    toast('Profile removed');
  };

  // Load data on mount
  useEffect(() => {
    // Safety timeout: if loading takes more than 3s, show the app anyway
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    Promise.all([
      dg('birthDate'),
      dg('milestones'),
      dg('vaccines'),
      dg('logs'),
      dg('teeth'),
      dg('firsts'),
      dg('darkMode'),
      dg('timerState'),
      dg('emergencyContacts'),
      dg('profiles'),
      dg('activeProfile'),
      dg('reminders'),
      dg('feedTimerApp'),
      dg('volumeUnit'),
    ]).then((r: any) => {
      if (r[6]) applyTheme(true);
      if (r[6]) setDarkModeR(true);
      if (r[7] != null) setTSR(r[7]);
      if (r[8] != null) setECR(r[8]);
      if (r[11] != null) setRemR(r[11]);
      if (r[12] != null) _setFTA(r[12]);
      if (r[13]) setVUR(r[13]);

      const loadedProfiles = r[9];
      const loadedActiveProfile = r[10];
      let activeId: number;

      if (!loadedProfiles || loadedProfiles.length === 0) {
        const defaultP: Profile = { id: 1, name: 'Baby', birthDate: r[0] || today() };
        setProfilesR([defaultP]);
        setActivePR(1);
        activeId = 1;
        ds('profiles', [defaultP]);
        ds('activeProfile', 1);
      } else {
        setProfilesR(loadedProfiles);
        activeId = loadedActiveProfile || loadedProfiles[0].id;
        setActivePR(activeId);
      }

      // Load profile-specific data
      dg(`profileData_${activeId}`).then((pData: any) => {
        if (pData) {
          setLgR(pData.logs || { feed: [], diaper: [], sleep: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
          setCkR(pData.milestones || {});
          setVDR(pData.vaccines || {});
          setThR(pData.teeth || {});
          setFiR(pData.firsts || []);
          if (pData.birthDate) setBR(pData.birthDate);
          else if (r[0] != null) setBR(r[0]);
        } else {
          if (r[0] != null) setBR(r[0]);
          if (r[1] != null) setCkR(r[1]);
          if (r[2] != null) setVDR(r[2]);
          if (r[3] != null) setLgR(r[3]);
          if (r[4] != null) setThR(r[4]);
          if (r[5] != null) setFiR(r[5]);
          ds(`profileData_${activeId}`, {
            logs: r[3] || { feed: [], diaper: [], sleep: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] },
            milestones: r[1] || {},
            vaccines: r[2] || {},
            teeth: r[4] || {},
            firsts: r[5] || [],
            birthDate: r[0] || null,
          });
        }
        clearTimeout(safetyTimer);
        setLoading(false);
      }).catch(() => {
        clearTimeout(safetyTimer);
        setLoading(false);
      });
    }).catch((err: Error) => {
      console.error('BabyBloom load error:', err);
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    return () => clearTimeout(safetyTimer);
  }, []);

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  // Handle Siri shortcuts
  const siriProcessed = useRef(false);
  useEffect(() => {
    if (loading || siriProcessed.current) return;
    const params = new URLSearchParams(window.location.search);
    const quick = params.get('quick');
    const voice = params.get('voice');
    if (!quick && !voice) return;
    siriProcessed.current = true;
    window.history.replaceState({}, '', window.location.pathname);

    // Siri quick actions would be implemented here
    // This is a placeholder for the full implementation
  }, [loading, logs]);

  // Feed reminder notifications — check immediately on mount, on visibility change, and on interval
  const lastNotifRef = useRef<string | null>(null);
  useEffect(() => {
    if (!reminders.enabled || !reminders.feedInterval) return;
    if ('Notification' in window && (Notification as any).permission === 'default')
      (Notification as any).requestPermission();
    lastNotifRef.current = null;

    function checkAndNotify() {
      if (!('Notification' in window) || (Notification as any).permission !== 'granted') return;
      const feeds = logs.feed || [];
      const lastFeed = feeds.length > 0 ? feeds[0] : null;
      if (lastFeed && lastFeed.date && lastFeed.time) {
        const dp = lastFeed.date.split('-');
        const parts = lastFeed.time.split(':');
        const lastTime = new Date(parseInt(dp[0]), parseInt(dp[1]) - 1, parseInt(dp[2]), parseInt(parts[0]), parseInt(parts[1]), 0);
        const feedKey = lastFeed.date + '_' + lastFeed.time;
        const diff = (Date.now() - lastTime.getTime()) / 3600000;
        if (diff >= reminders.feedInterval && lastNotifRef.current !== feedKey) {
          lastNotifRef.current = feedKey;
          new (Notification as any)('BabyBloom Reminder', {
            body: `Time for a feeding! Last feed was ${Math.round(diff * 10) / 10} hours ago.`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="80">🍼</text></svg>',
          });
        }
      }
    }

    // Check immediately on mount / when reminders or feeds change
    checkAndNotify();

    // Re-check when app returns to foreground (e.g. user switches back to tab/PWA)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkAndNotify();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Also keep periodic check as a fallback while app is open
    const intv = setInterval(checkAndNotify, 300000);

    return () => {
      clearInterval(intv);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reminders, logs.feed]);

  // Calculate age
  let age = 0;
  if (birth) {
    const b = new Date(birth + 'T00:00:00');
    const n = new Date();
    const diffMs = n.getTime() - b.getTime();
    age = Math.max(0, Math.min(24, diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
  }

  const babyName = profiles.length ? (profiles.find((p) => p.id === activeProfile)?.name || 'Baby') : 'Baby';

  // Active timer elapsed time for the persistent banners
  const activeTimerSource = feedTimerApp ? feedTimerApp.startTime : (timerState.running && timerState.startTime ? timerState.startTime : null);
  useEffect(() => {
    if (!activeTimerSource) {
      setAppTimerElapsed(0);
      return;
    }
    setAppTimerElapsed(Math.floor((Date.now() - activeTimerSource) / 1000));
    const iv = setInterval(() => {
      setAppTimerElapsed(Math.floor((Date.now() - activeTimerSource) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [activeTimerSource]);

  const showFeedBanner = feedTimerApp && tab !== 'home';
  const showTimerBanner = !feedTimerApp && timerState.running && timerState.startTime && tab !== 'log';
  const showAnyBanner = showFeedBanner || showTimerBanner;

  if (loading) {
    return (
      <div
        style={{
          maxWidth: 430,
          margin: '0 auto',
          background: C.bg,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 64 }}>🍼</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.t, marginTop: 12 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: C.bg, minHeight: '100vh', position: 'relative' }}>
      <div style={{ height: showAnyBanner ? 88 : 44 }} />

      {/* ═══ PERSISTENT RESUME BANNER — visible when a timer is active on a different tab ═══ */}
      {showAnyBanner && (
        <div
          onClick={() => navTo(showFeedBanner ? 'home' : 'log')}
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 430,
            width: '100%',
            zIndex: 60,
            padding: '6px 14px',
            background: `linear-gradient(135deg, ${C.a}, ${C.p})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 16 }}>{showFeedBanner ? (feedTimerApp!.type === 'Tummy Time' ? '🧒' : '🤱') : '⏱️'}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                {showFeedBanner ? feedTimerApp!.type : timerState.type} in progress
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
                Tap to resume
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'white',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.floor(appTimerElapsed / 60)}:{String(appTimerElapsed % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {birth ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 430,
            width: '100%',
            zIndex: 50,
            padding: '8px 12px',
            background: darkMode ? 'rgba(26,26,46,0.95)' : `linear-gradient(135deg, ${C.a}, ${C.p})`,
            backdropFilter: darkMode ? 'blur(20px)' : undefined,
            WebkitBackdropFilter: darkMode ? 'blur(20px)' : undefined,
            borderBottom: darkMode ? `1px solid ${C.b}` : 'none',
            boxShadow: darkMode ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🍼</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? C.t : '#fff', lineHeight: 1.2 }}>BabyBloom</div>
              {babyName !== 'Baby' && (
                <div style={{ fontSize: 11, color: darkMode ? C.p : 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1.2 }}>{babyName}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                background: 'none',
                border: 'none',
                borderRadius: 10,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Ic n={darkMode ? 'sun' : 'moon'} s={18} c={darkMode ? C.tl : 'rgba(255,255,255,0.9)'} />
            </button>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                background: 'none',
                border: 'none',
                borderRadius: 10,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Ic n="search" s={18} c={darkMode ? C.tl : 'rgba(255,255,255,0.9)'} />
            </button>
            <button
              onClick={() => setShowSet(true)}
              style={{
                background: 'none',
                border: 'none',
                borderRadius: 10,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Ic n="settings" s={18} c={darkMode ? C.tl : 'rgba(255,255,255,0.9)'} />
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'home' ? (
        <HomeTab
          age={age}
          setTab={navTo}
          checked={checked}
          birth={birth}
          setBirth={setBirth}
          logs={logs}
          setLogs={setLogs}
          babyName={babyName}
          reminders={reminders}
          feedTimerApp={feedTimerApp}
          setFeedTimerApp={setFeedTimerApp}
          volumeUnit={volumeUnit}
        />
      ) : null}
      {tab === 'log' ? (
        <LogTab
          logs={logs}
          setLogs={setLogs}
          age={age}
          subNavRef={subNavRef}
          quickFormRef={quickFormRef}
          timerState={timerState}
          setTimerState={setTimerState}
          volumeUnit={volumeUnit}
        />
      ) : null}
      {tab === 'miles' ? (
        <MilestonesTab
          age={age}
          selMo={selMo}
          setSelMo={setSelMo}
          checked={checked}
          setChecked={setChecked}
          teeth={teeth}
          setTeeth={setTeeth}
          firsts={firsts}
          setFirsts={setFirsts}
          subNavRef={subNavRef}
        />
      ) : null}
      {tab === 'guide' ? (
        <GuideTab age={age} vDone={vDone} setVDone={setVDone} subNavRef={subNavRef} logs={logs} birth={birth || ''} />
      ) : null}
      {tab === 'safety' ? (
        <SafetyTab subNavRef={subNavRef} emergencyContacts={emergencyContacts} setEmergencyContacts={setEmergencyContacts} />
      ) : null}

      {birth ? <TabBar active={tab} set={setTab} /> : null}

      {showSet ? (
        <Settings
          onClose={() => setShowSet(false)}
          birth={birth}
          profiles={profiles}
          activeProfile={activeProfile}
          onSwitchProfile={switchProfile}
          onAddProfile={addProfile}
          onDeleteProfile={deleteProfile}
          onRenameProfile={renameProfile}
          logs={logs}
          checked={checked}
          vDone={vDone}
          reminders={reminders}
          setReminders={setReminders}
          volumeUnit={volumeUnit}
          setVolumeUnit={setVolumeUnit}
        />
      ) : null}

      {showSearch ? (
        <SearchModal
          onClose={() => setShowSearch(false)}
          logs={logs}
          firsts={firsts}
          checked={checked}
          onNav={navTo}
        />
      ) : null}

      {siriResult ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 300,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSiriResult(null)}
        >
          <div
            style={{
              background: C.cd,
              borderRadius: 24,
              padding: '36px 32px',
              maxWidth: 320,
              width: '85%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.t, marginBottom: 8 }}>Logged!</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.s, marginBottom: 4 }}>{siriResult.cat}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.t }}>
              {siriResult.type}
              {siriResult.amount ? ` — ${siriResult.amount}` : ''}
            </div>
            <div style={{ fontSize: 13, color: C.tl, marginTop: 8 }}>{siriResult.time}</div>
            <div style={{ fontSize: 12, color: (C as any).ok, marginTop: 12 }}>Auto-closing...</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
