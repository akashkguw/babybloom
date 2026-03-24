import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import Card from '@/components/shared/Card';
import { isValidPhone, cleanStr, LIMITS } from '@/lib/utils/validate';
import { toast } from '@/lib/utils/toast';

interface Contact {
  id: number;
  name: string;
  phone: string;
  role: string;
}

interface AddContactFormProps {
  onAdd: (contact: Contact) => void;
}

export default function AddContactForm({ onAdd }: AddContactFormProps) {
  const [show, setShow] = useState(false);
  const [nm, setNm] = useState('');
  const [ph, setPh] = useState('');
  const [rl, setRl] = useState('');

  if (!show)
    return (
      <Button label="+ Add Contact" onClick={() => setShow(true)} color={C.s} full />
    );

  return (
    <Card style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.t, marginBottom: 12 }}>
        Add Contact
      </h3>
      <div style={{ marginBottom: 8 }}>
        <Input
          value={nm}
          onChange={setNm}
          placeholder="Name (e.g. Dr. Smith)"
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <Input
          value={ph}
          onChange={setPh}
          placeholder="Phone number"
          type="tel"
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Input
          value={rl}
          onChange={setRl}
          placeholder="Role (e.g. Pediatrician)"
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          label="Save"
          onClick={() => {
            const name = cleanStr(nm, LIMITS.nameLen);
            if (!name) { toast('Please enter a name'); return; }
            if (!isValidPhone(ph)) { toast('Please enter a valid phone number (at least 7 digits)'); return; }
            onAdd({
              id: Date.now(),
              name,
              phone: ph.trim(),
              role: cleanStr(rl, LIMITS.nameLen) || 'Other',
            });
            setNm('');
            setPh('');
            setRl('');
            setShow(false);
            toast('Contact saved!');
          }}
          color={C.s}
        />
        <Button
          label="Cancel"
          onClick={() => setShow(false)}
          outline
        />
      </div>
    </Card>
  );
}
