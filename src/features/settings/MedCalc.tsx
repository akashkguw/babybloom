import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Input from '@/components/shared/Input';
import Card from '@/components/shared/Card';
import { clampNum, LIMITS } from '@/lib/utils/validate';

export default function MedCalc() {
  const [wt, setWt] = useState('');
  const handleWt = (v: string) => setWt(clampNum(v, LIMITS.weightLbs.min, LIMITS.weightLbs.max));

  const kg = wt ? parseFloat(wt) / 2.205 : 0;
  const tylenolLow = Math.round(kg * 10 * 10) / 10;
  const tylenolHigh = Math.round(kg * 15 * 10) / 10;
  const tylenolMlLow = Math.round((tylenolLow / 160) * 5 * 10) / 10;
  const tylenolMlHigh = Math.round((tylenolHigh / 160) * 5 * 10) / 10;
  const ibuprofenLow = Math.round(kg * 5 * 10) / 10;
  const ibuprofenHigh = Math.round(kg * 10 * 10) / 10;
  const ibuprofenMlLow = Math.round((ibuprofenLow / 100) * 5 * 10) / 10;
  const ibuprofenMlHigh = Math.round((ibuprofenHigh / 100) * 5 * 10) / 10;

  return (
    <>
      <Card
        style={{
          marginBottom: 12,
          borderLeft: '4px solid ' + C.p,
          background: C.pl + '44',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: C.p, marginBottom: 4 }}>
          Important Disclaimer
        </div>
        <div style={{ fontSize: 13, color: C.t, lineHeight: 1.5 }}>
          Always confirm dosages with your pediatrician. This calculator is for reference only. Never give ibuprofen
          to babies under 6 months.
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t, marginBottom: 8 }}>Enter Baby's Weight</div>
        <Input type="number" value={wt} onChange={handleWt} placeholder="Weight in lbs (1–60)" />
        {wt && (
          <div style={{ fontSize: 12, color: C.tl, marginTop: 4 }}>
            {parseFloat(wt).toFixed(1)} lbs = {kg.toFixed(1)} kg
          </div>
        )}
      </Card>

      {wt && parseFloat(wt) > 0 && (
        <>
          <Card
            style={{
              marginBottom: 12,
              borderLeft: '4px solid ' + C.bl,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 20 }}>🟣</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
                  Infant Acetaminophen (Tylenol)
                </div>
                <div style={{ fontSize: 12, color: C.tl }}>Concentration: 160 mg / 5 mL</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.t, marginBottom: 4 }}>
              Dose: {tylenolLow} – {tylenolHigh} mg
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.bl }}>
              {tylenolMlLow} – {tylenolMlHigh} mL
            </div>
            <div style={{ fontSize: 11, color: C.tl, marginTop: 4 }}>
              Every 4-6 hours as needed. Max 5 doses in 24 hrs.
            </div>
          </Card>

          <Card
            style={{
              marginBottom: 12,
              borderLeft: '4px solid ' + C.w,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 20 }}>🟠</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
                  Infant Ibuprofen (Advil/Motrin)
                </div>
                <div style={{ fontSize: 12, color: C.tl }}>Concentration: 100 mg / 5 mL</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.p }}>6+ months only!</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.t, marginBottom: 4 }}>
              Dose: {ibuprofenLow} – {ibuprofenHigh} mg
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.w }}>
              {ibuprofenMlLow} – {ibuprofenMlHigh} mL
            </div>
            <div style={{ fontSize: 11, color: C.tl, marginTop: 4 }}>
              Every 6-8 hours as needed. Max 4 doses in 24 hrs.
            </div>
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 6 }}>
              Quick Reference
            </div>
            <ul style={{ fontSize: 13, color: C.t, lineHeight: 1.6, paddingLeft: 16 }}>
              <li>Never alternate Tylenol & Motrin without doctor's OK</li>
              <li>Use the syringe that comes with the medicine</li>
              <li>Don't use adult formulations</li>
              <li>Fever reducers treat discomfort, not the infection</li>
              <li>Call doctor before giving meds to babies under 3 months</li>
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
