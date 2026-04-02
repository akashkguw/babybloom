import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dg, ds } from '@/lib/db';
import { today } from '@/lib/utils/date';
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
import PartnerSync from '@/features/sync/PartnerSync';
import CloudSync from '@/features/sync/CloudSync';
import { MAX_FAMILY_MEMBERS } from '@/features/profiles/ProfileManager';
import PediatrReport from '@/features/reports/PediatrReport';
import { getCountryConfig, detectCountry } from '@/lib/constants/countries';
import type { CountryCode } from '@/lib/constants/countries';
import { isNative, setStatusBarStyle, sendNotification } from '@/lib/native';
import { checkFeedNotification } from '@/lib/utils/feedNotification';
import { handleOAuthCallback } from '@/lib/sync/googleDrive';
import { isSyncEnabled, startSyncEngine, notifyDataWrite, onSyncStatus } from '@/lib/sync/syncEngine';
import type { SyncStatus } from '@/lib/sync/types';

const displayName = (type: string): string => {
  const map: Record<string, string> = { 'Breast L': 'Nurse Left', 'Breast R': 'Nurse Right' };
  return map[type] || type;
};

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
  // vDoneAll stores vaccine checkmarks namespaced by country: { US: {...}, IN: {...} }
  // This ensures switching countries never loses data
  const [vDoneAll, setVDAllR] = useState<any>({});
  const [logs, setLgR] = useState<any>({ feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
  const [teeth, setThR] = useState<any>({});
  const [firsts, setFiR] = useState<any[]>([]);
  // Default to US contacts for backward compatibility — overridden by saved data or country switch
  const [emergencyContacts, setECR] = useState<EmergencyContact[]>([
    { id: 1, name: 'Emergency', phone: '911', role: 'Emergency' },
    { id: 2, name: 'Poison Control', phone: '1-800-222-1222', role: 'Poison Control' },
  ]);
  const [profiles, setProfilesR] = useState<Profile[]>([]);
  const [activeProfile, setActivePR] = useState<number | null>(null);
  const [showSet, setShowSet] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showSync, setShowSync] = useState<boolean>(false);
  const [showCloudSync, setShowCloudSync] = useState<boolean>(false);
  const [navSyncStatus, setNavSyncStatus] = useState<SyncStatus | null>(null);
  const [showReport, setShowReport] = useState<boolean>(false);
  const [showGuideFromSettings, setShowGuideFromSettings] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [darkMode, setDarkModeR] = useState<boolean>(true);
  const [reminders, setRemR] = useState<Reminders>({ feedInterval: 0, enabled: true });
  const [volumeUnit, setVUR] = useState<'ml' | 'oz'>('ml');
  const [feedTimerApp, _setFTA] = useState<FeedTimerApp | null>(null);
  const [siriResult, setSiriResult] = useState<SiriResult | null>(null);
  const [appTimerElapsed, setAppTimerElapsed] = useState(0);
  const [quickFeedType, setQuickFeedType] = useState<string | null>(null);
  const [sliderVal, setSliderVal] = useState(0);
  const [country, setCountryR] = useState<CountryCode>(detectCountry());

  // Derived country config — recalculated when country changes
  const countryConfig = useMemo(() => getCountryConfig(country), [country]);

  const setCountry = (v: CountryCode) => {
    setCountryR(v);
    ds('country', v);
    // Update defaults based on new country
    const cfg = getCountryConfig(v);
    setVolumeUnit(cfg.defaults.volumeUnit);
    // Update emergency contacts to country defaults (keep user-added contacts with id > 2)
    setEmergencyContacts((prev: EmergencyContact[]) => {
      const userContacts = prev.filter((c) => c.id > 2);
      return [...cfg.emergency.defaultContacts, ...userContacts];
    });
    toast(`Switched to ${cfg.flag} ${cfg.name}`);
  };

  // Wrapper functions for persistence
  const setEmergencyContacts = (v: EmergencyContact[] | ((prev: EmergencyContact[]) => EmergencyContact[])) => {
    if (typeof v === 'function') {
      setECR((prev: EmergencyContact[]) => {
        const next = v(prev);
        ds('emergencyContacts', next);
        notifyDataWrite();
        return next;
      });
    } else {
      setECR(v);
      ds('emergencyContacts', v);
      notifyDataWrite();
    }
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
    // Add transition class for smooth theme switch
    document.documentElement.classList.add('theme-transition');
    setDarkModeR(v);
    applyTheme(v);
    ds('darkMode', v);
    // Update native status bar to match theme
    if (isNative) setStatusBarStyle(v);
    // Remove transition class after animation completes
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 500);
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
    // Intercept special modal targets
    if (t === '_sync') { setShowSync(true); return; }
    if (t === '_report') { setShowReport(true); return; }
    subNavRef.current = sub || null;
    quickFormRef.current = formData || null;
    setTab(t);
  };

  // Save field to both global and profile-specific keys, then notify sync engine
  const spd = (field: string, val: any) => {
    ds(field, val);
    if (activeProfile) {
      dg(`profileData_${activeProfile}`).then((d: any) => {
        const data = d || {};
        data[field] = val;
        ds(`profileData_${activeProfile}`, data);
      });
    }
    // Notify sync engine so changes are uploaded promptly (debounced 2s in engine)
    notifyDataWrite();
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

  // Derived: current country's vaccine checkmarks
  const vDone = useMemo(() => vDoneAll[country] || {}, [vDoneAll, country]);

  const setVDone = (fn: any) => {
    if (typeof fn === 'function') {
      setVDAllR((prev: any) => {
        const currentSlice = prev[country] || {};
        const updated = fn(currentSlice);
        const next = { ...prev, [country]: updated };
        spd('vaccines', next);
        return next;
      });
    } else {
      setVDAllR((prev: any) => {
        const next = { ...prev, [country]: fn };
        spd('vaccines', next);
        return next;
      });
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

  /**
   * Migrate old flat vDone ({0_0: true, 2_3: true}) to country-namespaced format
   * ({US: {0_0: true, 2_3: true}}).
   * If already namespaced (has country code keys), return as-is.
   */
  const migrateVDone = (raw: any): any => {
    if (!raw || typeof raw !== 'object') return {};
    // Check if already namespaced: top-level keys should be country codes
    const keys = Object.keys(raw);
    if (keys.length === 0) return {};
    const countryCodes = ['US', 'IN', 'UK', 'AU', 'CA']; // known + future
    const isNamespaced = keys.some((k) => countryCodes.includes(k));
    if (isNamespaced) return raw;
    // Old format: flat {0_0: true, ...} — migrate to {US: {...}} for existing US users
    return { US: raw };
  };

  // Profile data persistence
  const saveProfileData = (profileId: number | null) => {
    if (!profileId) return Promise.resolve();
    const data = { logs, milestones: checked, vaccines: vDoneAll, teeth, firsts, birthDate: birth };
    return ds(`profileData_${profileId}`, data);
  };

  const loadProfileData = (profileId: number) => {
    return dg(`profileData_${profileId}`).then((data: any) => {
      if (data) {
        setLgR(data.logs || { feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
        setCkR(data.milestones || {});
        setVDAllR(migrateVDone(data.vaccines));
        setThR(data.teeth || {});
        setFiR(data.firsts || []);
        if (data.birthDate) setBR(data.birthDate);
      } else {
        const prof = profiles.find((p) => p.id === profileId);
        setLgR({ feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
        setCkR({});
        setVDAllR({});
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
    if (profiles.length >= MAX_FAMILY_MEMBERS) {
      toast(`Family is full — maximum ${MAX_FAMILY_MEMBERS} members allowed`);
      return;
    }
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

  // ── Sync engine startup ─────────────────────────────────────────────────
  // If the user already enabled sync in a previous session, restart the engine
  // on every app load (timers and event listeners are lost on page navigation).
  useEffect(() => {
    isSyncEnabled().then((enabled) => {
      if (enabled) {
        startSyncEngine().catch(() => {});
        // Subscribe to sync status for the nav dot indicator
        const unsub = onSyncStatus((s) => setNavSyncStatus(s));
        return () => unsub();
      }
    });
  }, []); // run once on mount

  // ── Web OAuth callback handler ──────────────────────────────────────────
  // When Google redirects to /oauth?code=... (web PWA flow), this fires once
  // on mount and completes the token exchange before anything else renders.
  // Native deep links are handled separately in native.ts via appUrlOpen.
  useEffect(() => {
    if (isNative) return; // native uses deep link handler in native.ts

    // Two ways to land here with an OAuth code:
    //
    // 1. Direct path match — local dev (Vite handles /babybloom/oauth as a SPA route)
    //    URL: http://localhost:5173/babybloom/oauth?code=...
    //
    // 2. sessionStorage bounce — GitHub Pages (static host can't serve /oauth as a route).
    //    public/oauth/index.html stores the callback URL in sessionStorage then
    //    redirects to /babybloom/, where we pick it up here.
    //    URL after bounce: https://akashkguw.github.io/babybloom/
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const oauthPath = `${base}/oauth`;
    const storedCallback = sessionStorage.getItem('bb_oauth_callback');

    const isDirectPath = window.location.pathname === oauthPath
      || window.location.pathname === oauthPath + '/';
    const callbackUrl = storedCallback || (isDirectPath ? window.location.href : null);
    if (!callbackUrl) return;

    // Clean up before any async work
    sessionStorage.removeItem('bb_oauth_callback');
    if (isDirectPath) window.history.replaceState({}, '', import.meta.env.BASE_URL);

    handleOAuthCallback(callbackUrl)
      .then(() => {
        // Tokens stored — start/restart sync engine now that we're authenticated,
        // then signal the CloudSync UI to refresh its auth state.
        startSyncEngine().catch(() => {});
        // Mount CloudSync FIRST, then dispatch the event on the next tick
        // so CloudSync's useEffect listener is registered before the event fires.
        setShowCloudSync(true);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('babybloom:oauth'));
        }, 0);
      })
      .catch((err: any) => {
        toast('Google sign-in failed: ' + (err?.message || 'unknown error'));
        console.error('[BabyBloom] Web OAuth callback error:', err);
      });
  }, []); // run once on mount — intentionally no deps

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
      dg('emergencyContacts'),
      dg('profiles'),
      dg('activeProfile'),
      dg('reminders'),
      dg('feedTimerApp'),
      dg('volumeUnit'),
      dg('country'),
    ]).then((r: any) => {
      // Load saved country or detect from browser
      const savedCountry = r[13] as CountryCode | null;
      if (savedCountry) {
        setCountryR(savedCountry);
      } else {
        const detected = detectCountry();
        setCountryR(detected);
      }
      const activeCountry = savedCountry || detectCountry();
      const cfg = getCountryConfig(activeCountry);
      // Dark mode is default (true). Only switch to light if user explicitly saved false.
      if (r[6] === false) {
        applyTheme(false);
        setDarkModeR(false);
      } else {
        applyTheme(true);
        setDarkModeR(true);
      }
      if (r[7] != null) setECR(r[7]);
      else setECR(cfg.emergency.defaultContacts);
      if (r[10] != null) setRemR(r[10]);
      if (r[11] != null) _setFTA(r[11]);
      if (r[12]) setVUR(r[12]);
      else setVUR(cfg.defaults.volumeUnit);

      const loadedProfiles = r[8];
      const loadedActiveProfile = r[9];
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
          setLgR(pData.logs || { feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
          setCkR(pData.milestones || {});
          setVDAllR(migrateVDone(pData.vaccines));
          setThR(pData.teeth || {});
          setFiR(pData.firsts || []);
          if (pData.birthDate) setBR(pData.birthDate);
          else if (r[0] != null) setBR(r[0]);
        } else {
          if (r[0] != null) setBR(r[0]);
          if (r[1] != null) setCkR(r[1]);
          if (r[2] != null) setVDAllR(migrateVDone(r[2]));
          setLgR(r[3] || { feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
          if (r[4] != null) setThR(r[4]);
          if (r[5] != null) setFiR(r[5]);
          ds(`profileData_${activeId}`, {
            logs: r[3] || { feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] },
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
        // Ensure logs are properly initialized even on profile data load failure
        setLgR((prev: any) => (prev && prev.feed ? prev : { feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] }));
        clearTimeout(safetyTimer);
        setLoading(false);
      });
    }).catch((err: Error) => {
      console.error('BabyBloom load error:', err);
      // Ensure logs are properly initialized even on full load failure
      setLgR((prev: any) => (prev && prev.feed ? prev : { feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] }));
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    return () => clearTimeout(safetyTimer);
  }, []);

  // Reload data from IndexedDB after cloud sync applies a merged snapshot.
  // Without this, users must reload the page to see partner's data.
  useEffect(() => {
    const onSyncApplied = () => {
      dg('activeProfile').then((apId: any) => {
        const pid = apId || activeProfile;
        if (!pid) return;
        dg(`profileData_${pid}`).then((pData: any) => {
          if (!pData) return;
          setLgR(pData.logs || { feed: [], diaper: [], sleep: [], tummy: [], growth: [], temp: [], bath: [], massage: [], meds: [], allergy: [] });
          setCkR(pData.milestones || {});
          setVDAllR(migrateVDone(pData.vaccines));
          setThR(pData.teeth || {});
          setFiR(pData.firsts || []);
          if (pData.birthDate) setBR(pData.birthDate);
        });
        // Also refresh emergency contacts (not profile-scoped)
        dg('emergencyContacts').then((ec: any) => { if (ec) setECR(ec); });
      });
    };
    window.addEventListener('babybloom:sync-applied', onSyncApplied);
    return () => window.removeEventListener('babybloom:sync-applied', onSyncApplied);
  }, [activeProfile]);

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

  // Feed reminder notifications are set up after age calculation below

  // Calculate age
  let age = 0;
  if (birth) {
    const b = new Date(birth + 'T00:00:00');
    const n = new Date();
    const diffMs = n.getTime() - b.getTime();
    age = Math.max(0, Math.min(24, diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
  }

  const babyName = profiles.length ? (profiles.find((p) => p.id === activeProfile)?.name || 'Baby') : 'Baby';

  // Smart age-based feed interval (auto-adjusts to baby's developmental stage)
  const smartFeedInterval = (() => {
    if (age < 1) return 2;      // Newborn: every 2h
    if (age < 3) return 2.5;    // 1-3 months: every 2.5h
    if (age < 6) return 3;      // 3-6 months: every 3h
    if (age < 9) return 3.5;    // 6-9 months: every 3.5h
    if (age < 12) return 4;     // 9-12 months: every 4h
    return 5;                    // 12+ months: every 5h
  })();

  // Feed reminder notifications — check immediately on mount, on visibility change, and on interval
  // The dedup key is persisted to IndexedDB so the same overdue feed doesn't re-notify across app opens
  const lastNotifRef = useRef<string | null>(null);
  const notifRefLoaded = useRef(false);
  useEffect(() => {
    if (!reminders.enabled) return;
    if (!isNative && 'Notification' in window && (Notification as any).permission === 'default')
      (Notification as any).requestPermission();

    const interval = smartFeedInterval;
    let cancelled = false;

    function checkAndNotify() {
      if (!notifRefLoaded.current) return; // wait for persisted key to load
      if (!isNative && (!('Notification' in window) || (Notification as any).permission !== 'granted')) return;
      const feeds = logs.feed || [];
      const result = checkFeedNotification(feeds, interval, lastNotifRef.current);
      if (result.shouldNotify && result.feedKey && result.body) {
        lastNotifRef.current = result.feedKey;
        ds('lastFeedNotifKey', result.feedKey);
        sendNotification('BabyBloom Reminder', result.body);
      }
    }

    // Load persisted dedup key, then run first check
    if (!notifRefLoaded.current) {
      dg('lastFeedNotifKey').then((v: any) => {
        if (cancelled) return;
        if (v && typeof v === 'string') lastNotifRef.current = v;
        notifRefLoaded.current = true;
        checkAndNotify();
      });
    } else {
      checkAndNotify();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkAndNotify();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    const intv = setInterval(checkAndNotify, 300000);

    return () => {
      cancelled = true;
      clearInterval(intv);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reminders, logs.feed, smartFeedInterval]);

  // Active timer elapsed time for the persistent banners
  const activeTimerSource = feedTimerApp ? feedTimerApp.startTime : null;
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
  const showAnyBanner = showFeedBanner;

  if (loading) {
    return (
      <div
        style={{
          maxWidth: 500,
          margin: '0 auto',
          background: C.bg,
          height: '100dvh',
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
    <div style={{ maxWidth: 500, margin: '0 auto', background: C.bg, height: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Spacer to push content below the fixed header */}
      <div className="header-spacer" />
      {showAnyBanner && <div className="banner-spacer" />}

      {/* ═══ PERSISTENT RESUME BANNER — visible when feed timer is active on a different tab ═══ */}
      {showAnyBanner && (
        <div
          onClick={() => navTo('home')}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 60,
            padding: 'calc(6px + env(safe-area-inset-top, 0px)) 14px 6px',
            background: `linear-gradient(135deg, #FF6B8A, #FF8FA0, #FFA5B4)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 16 }}>{feedTimerApp!.type === 'Tummy Time' ? '🧒' : '🤱'}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                {displayName(feedTimerApp!.type)} in progress
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

      {birth && !showSet ? (
        <div
          className="app-header"
          style={{
            background: darkMode ? `linear-gradient(135deg, ${C.sl}, ${C.pl})` : `linear-gradient(135deg, #FF6B8A, #FF8FA0, #FFA5B4)`,
            boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🍼</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>BabyBloom</div>
              {babyName !== 'Baby' && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1.2 }}>{babyName}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              <Ic n={darkMode ? 'sun' : 'moon'} s={18} c="rgba(255,255,255,0.9)" />
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
              <Ic n="search" s={18} c="rgba(255,255,255,0.9)" />
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
              <Ic n="settings" s={18} c="rgba(255,255,255,0.9)" />
            </button>
          </div>
        </div>
      ) : null}

      {showSet ? (
        <Settings
          onClose={() => setShowSet(false)}
          birth={birth}
          setBirth={setBirth}
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
          onShowReport={() => { setShowReport(true); }}
          onSync={() => { setShowSet(false); setShowSync(true); }}
          onCloudSync={() => { setShowSet(false); setShowCloudSync(true); }}
          onShowGuide={() => { setShowSet(false); setShowGuideFromSettings(true); setTab('home'); }}
          country={country}
          setCountry={setCountry}
          countryConfig={countryConfig}
        />
      ) : (
        <>
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
              vDone={vDone}
              setVDone={setVDone}
              quickFeedType={quickFeedType}
              setQuickFeedType={setQuickFeedType}
              sliderVal={sliderVal}
              setSliderVal={setSliderVal}
              countryConfig={countryConfig}
              country={country}
              setCountry={setCountry}
              showGuideFromSettings={showGuideFromSettings}
              onGuideShown={() => setShowGuideFromSettings(false)}
              syncStatus={navSyncStatus}
              onOpenCloudSync={() => setShowCloudSync(true)}
            />
          ) : null}
          {tab === 'log' ? (
            <LogTab
              logs={logs}
              setLogs={setLogs}
              age={age}
              subNavRef={subNavRef}
              quickFormRef={quickFormRef}
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
            <GuideTab age={age} vDone={vDone} setVDone={setVDone} subNavRef={subNavRef} logs={logs} birth={birth || ''} countryConfig={countryConfig} />
          ) : null}
          {tab === 'safety' ? (
            <SafetyTab subNavRef={subNavRef} emergencyContacts={emergencyContacts} setEmergencyContacts={setEmergencyContacts} countryConfig={countryConfig} />
          ) : null}
        </>
      )}

      {birth ? <TabBar active={tab} set={(t: string) => { setShowSet(false); setTab(t); }} /> : null}

      {showSearch ? (
        <SearchModal
          onClose={() => setShowSearch(false)}
          logs={logs}
          firsts={firsts}
          checked={checked}
          onNav={navTo}
        />
      ) : null}

      {showSync ? (
        <PartnerSync
          logs={logs}
          setLogs={setLogs}
          babyName={babyName}
          birth={birth}
          onClose={() => setShowSync(false)}
        />
      ) : null}

      {showCloudSync ? (
        <CloudSync onClose={() => setShowCloudSync(false)} />
      ) : null}

      {showReport ? (
        <PediatrReport
          logs={logs}
          babyName={babyName}
          birth={birth}
          age={age}
          vDone={vDone}
          volumeUnit={volumeUnit}
          onClose={() => setShowReport(false)}
          countryConfig={countryConfig}
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
