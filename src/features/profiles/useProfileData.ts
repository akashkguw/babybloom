import { dg, ds } from '@/lib/db/indexeddb';

export interface ProfileData {
  logs?: any;
  milestones?: any;
  vaccines?: any;
  teeth?: any;
  firsts?: any;
  birthDate?: string;
}

export async function saveProfileData(profileId: number, data: ProfileData): Promise<void> {
  if (!profileId) return Promise.resolve() as any;
  return ds(`profileData_${profileId}`, data) as any;
}

export async function loadProfileData(profileId: number): Promise<ProfileData | null> {
  if (!profileId) return null;
  return dg(`profileData_${profileId}`) as any;
}

export async function switchProfile(fromId: number, toId: number, currentData: any): Promise<void> {
  // Save current profile data before switching
  if (fromId) {
    const data = {
      logs: currentData.logs,
      milestones: currentData.checked,
      vaccines: currentData.vDone,
      teeth: currentData.teeth,
      firsts: currentData.firsts,
      birthDate: currentData.birth,
    };
    await saveProfileData(fromId, data);
  }

  // Load new profile data
  const newData = await loadProfileData(toId);
  return newData as any;
}

// Helper: save per-profile data
export function spd(
  field: string,
  val: any,
  activeProfile: number | null,
  globalSetter: (key: string, val: any) => void
): void {
  globalSetter(field, val);
  if (activeProfile) {
    dg(`profileData_${activeProfile}`).then((data: any) => {
      const updated = data || {};
      if (field === 'birthDate') updated.birthDate = val;
      else if (field === 'milestones') updated.milestones = val;
      else if (field === 'vaccines') updated.vaccines = val;
      else if (field === 'logs') updated.logs = val;
      else if (field === 'teeth') updated.teeth = val;
      else if (field === 'firsts') updated.firsts = val;
      ds(`profileData_${activeProfile}`, updated);
    });
  }
}
