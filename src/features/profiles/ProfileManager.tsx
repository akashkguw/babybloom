import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import Icon from '@/components/shared/Icon';
import Card from '@/components/shared/Card';
import { today } from '@/lib/utils/date';
import { isValidBirthDate, cleanStr, LIMITS } from '@/lib/utils/validate';
import { toast } from '@/lib/utils/toast';

export const MAX_FAMILY_MEMBERS = 3;
interface Profile {
  id: number;
  name: string;
  birthDate?: string;
}

interface ProfileManagerProps {
  profiles: Profile[];
  activeProfile: number | null;
  onSwitch: (id: number) => void;
  onAdd: (profile: Profile) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, name: string) => void;
}

export default function ProfileManager({
  profiles,
  activeProfile,
  onSwitch,
  onAdd,
  onDelete,
  onRename,
}: ProfileManagerProps) {
  const [show, setShow] = useState(false);
  const [nm, setNm] = useState('');
  const [bd, setBd] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editNm, setEditNm] = useState('');

  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 8 }}>
        Baby Profiles
      </div>
      {profiles.map((p) => {
        const isActive = p.id === activeProfile;
        const isEditing = editId === p.id;
        return (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: isActive ? C.sl : C.bg,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: isActive ? C.s : C.b,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? 'white' : C.tl,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1 }}>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={editNm}
                    maxLength={LIMITS.nameLen}
                    onChange={(e) => setEditNm(e.target.value)}
                    style={{
                      fontSize: 14,
                      padding: '4px 8px',
                      borderRadius: 8,
                      border: '1px solid ' + C.b,
                      background: C.bg,
                      color: C.t,
                      width: '100%',
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editNm.trim()) {
                        onRename(p.id, editNm.trim());
                        setEditId(null);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (editNm.trim()) {
                        onRename(p.id, editNm.trim());
                        setEditId(null);
                      }
                    }}
                    style={{
                      background: C.s,
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: C.tl,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: isActive ? 700 : 500,
                      color: C.t,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setEditId(p.id);
                      setEditNm(p.name);
                    }}
                  >
                    {p.name} <span style={{ fontSize: 10, color: C.tl }}>(tap to rename)</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.tl }}>
                    {p.birthDate
                      ? new Date(p.birthDate + 'T00:00:00').toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : ''}
                  </div>
                </>
              )}
            </div>

            {isEditing ? null : isActive ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.s,
                  background: C.sl,
                  padding: '2px 8px',
                  borderRadius: 8,
                }}
              >
                Active
              </span>
            ) : (
              <button
                onClick={() => onSwitch(p.id)}
                style={{
                  background: C.s,
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Switch
              </button>
            )}

            {!isActive && profiles.length > 1 && !isEditing && (
              <button
                onClick={() => onDelete(p.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <Icon n="x" s={14} c={C.tl} />
              </button>
            )}
          </div>
        );
      })}

      {profiles.length >= MAX_FAMILY_MEMBERS ? (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: C.cd,
            border: '1px solid ' + C.b,
            fontSize: 13,
            color: C.tl,
            textAlign: 'center',
          }}
        >
          Family is full — maximum {MAX_FAMILY_MEMBERS} members allowed
        </div>
      ) : !show ? (
        <Button
          label="+ Add Baby"
          onClick={() => setShow(true)}
          color={C.s}
          outline
          full
        />
      ) : (
        <Card style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <Input value={nm} onChange={setNm} placeholder="Baby's name" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <Input type="date" value={bd} onChange={setBd} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              label="Add"
              onClick={() => {
                const name = cleanStr(nm, LIMITS.nameLen);
                if (!name) { toast('Please enter a name'); return; }
                const birthDate = bd || today();
                if (!isValidBirthDate(birthDate)) { toast('Please enter a valid birth date (not in the future)'); return; }

                onAdd({ id: Date.now(), name, birthDate });
                setNm('');
                setBd('');
                setShow(false);
              }}
              color={C.s}
            />
            <Button label="Cancel" onClick={() => setShow(false)} outline />
          </div>
        </Card>
      )}
    </>
  );
}
