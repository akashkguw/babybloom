import React, { useState } from 'react';
import { C } from '@/lib/constants/colors';
import Input from '@/components/shared/Input';
import Card from '@/components/shared/Card';
import { clampNum } from '@/lib/utils/validate';
import type { CountryConfig } from '@/lib/constants/countries';

interface MedCalcProps {
  countryConfig: CountryConfig;
}

export default function MedCalc({ countryConfig }: MedCalcProps) {
  const [wt, setWt] = useState('');
  const { defaults, medicines } = countryConfig;
  const { antipyretic: med1, antiInflammatory: med2, tips } = medicines;

  const handleWt = (v: string) =>
    setWt(clampNum(v, defaults.weightLimits.min, defaults.weightLimits.max));

  // Convert input weight to kg
  const kg = wt ? parseFloat(wt) / defaults.weightToKgDivisor : 0;

  // Medicine 1 (Paracetamol / Acetaminophen) dosing
  const med1Low = Math.round(kg * med1.doseLowPerKg * 10) / 10;
  const med1High = Math.round(kg * med1.doseHighPerKg * 10) / 10;
  const med1MlLow = Math.round((med1Low / med1.concentrationMg) * 5 * 10) / 10;
  const med1MlHigh = Math.round((med1High / med1.concentrationMg) * 5 * 10) / 10;

  // Medicine 2 (Ibuprofen) dosing
  const med2Low = Math.round(kg * med2.doseLowPerKg * 10) / 10;
  const med2High = Math.round(kg * med2.doseHighPerKg * 10) / 10;
  const med2MlLow = Math.round((med2Low / med2.concentrationMg) * 5 * 10) / 10;
  const med2MlHigh = Math.round((med2High / med2.concentrationMg) * 5 * 10) / 10;

  // Weight display
  const wtDisplay = wt
    ? defaults.weightUnit === 'kg'
      ? `${parseFloat(wt).toFixed(1)} kg`
      : `${parseFloat(wt).toFixed(1)} lbs = ${kg.toFixed(1)} kg`
    : '';

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
          Always confirm dosages with your {countryConfig.code === 'IN' ? 'paediatrician' : 'pediatrician'}. This calculator is for reference only. Never give ibuprofen
          to babies under 6 months.
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t, marginBottom: 8 }}>Enter Baby's Weight</div>
        <Input type="number" value={wt} onChange={handleWt} placeholder={defaults.weightPlaceholder} />
        {wt && (
          <div style={{ fontSize: 12, color: C.tl, marginTop: 4 }}>
            {wtDisplay}
          </div>
        )}
      </Card>

      {wt && parseFloat(wt) > 0 && (
        <>
          {/* Medicine 1: Paracetamol/Acetaminophen */}
          <Card
            style={{
              marginBottom: 12,
              borderLeft: '4px solid ' + C.bl,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 20 }}>{med1.emoji}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
                  {med1.name}
                </div>
                <div style={{ fontSize: 12, color: C.tl }}>Concentration: {med1.concentrationLabel}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.t, marginBottom: 4 }}>
              Dose: {med1Low} – {med1High} mg
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.bl }}>
              {med1MlLow} – {med1MlHigh} mL
            </div>
            <div style={{ fontSize: 11, color: C.tl, marginTop: 4 }}>
              {med1.frequency}. {med1.maxDoses}.
            </div>
          </Card>

          {/* Medicine 2: Ibuprofen */}
          <Card
            style={{
              marginBottom: 12,
              borderLeft: '4px solid ' + C.w,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 20 }}>{med2.emoji}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>
                  {med2.name}
                </div>
                <div style={{ fontSize: 12, color: C.tl }}>Concentration: {med2.concentrationLabel}</div>
                {med2.ageRestriction && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.p }}>{med2.ageRestriction}</div>
                )}
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.t, marginBottom: 4 }}>
              Dose: {med2Low} – {med2High} mg
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.w }}>
              {med2MlLow} – {med2MlHigh} mL
            </div>
            <div style={{ fontSize: 11, color: C.tl, marginTop: 4 }}>
              {med2.frequency}. {med2.maxDoses}.
            </div>
          </Card>

          {/* Quick Reference */}
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 6 }}>
              Quick Reference
            </div>
            <ul style={{ fontSize: 13, color: C.t, lineHeight: 1.6, paddingLeft: 16 }}>
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
