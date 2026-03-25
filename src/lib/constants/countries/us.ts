/**
 * United States Country Configuration
 * Medical guidelines: AAP (American Academy of Pediatrics), CDC, FDA
 * Vaccine schedule: CDC/ACIP Recommended Immunization Schedule
 */

import type { CountryConfig } from './types';

export const US_CONFIG: CountryConfig = {
  code: 'US',
  name: 'United States',
  flag: '\u{1F1FA}\u{1F1F8}',
  defaultLocale: 'en-US',
  locales: ['en-US'],

  defaults: {
    volumeUnit: 'oz',
    temperatureUnit: 'F',
    dateFormat: 'MM/DD/YYYY',
    weightUnit: 'lbs',
    weightToKgDivisor: 2.205,
    weightPlaceholder: 'Weight in lbs (1\u201360)',
    weightLimits: { min: 1, max: 60 },
  },

  emergency: {
    primaryNumber: '911',
    poisonControl: '1-800-222-1222',
    pediatricHotline: '1-800-222-1222',
    defaultContacts: [
      { id: 1, name: 'Emergency', phone: '911', role: 'Emergency' },
      { id: 2, name: 'Poison Control', phone: '1-800-222-1222', role: 'Poison Control' },
    ],
    bannerTitle: 'Emergency: Call 911',
    bannerSubtitle: 'Poison Control: 1-800-222-1222',
  },

  medical: {
    authority: 'AAP',
    authorityFull: 'American Academy of Pediatrics',
    formulaRegulator: 'FDA',
    cprOrganization: 'American Red Cross',
    cprOrganizationFull: 'American Red Cross or American Heart Association',
    normalTempRange: '97\u2013100.3\u00B0F (36.1\u201337.9\u00B0C)',
    sleepRoomTemp: '68-72\u00B0F',
    massageRoomTemp: '75-80\u00B0F',
  },

  vaccines: [
    {
      age: 'Birth',
      v: [{ n: 'Hepatitis B', d: '1st dose' }],
    },
    {
      age: '1 Month',
      v: [{ n: 'Hepatitis B', d: '2nd dose' }],
    },
    {
      age: '2 Months',
      v: [
        { n: 'DTaP', d: '1st dose' },
        { n: 'IPV (Polio)', d: '1st dose' },
        { n: 'Hib', d: '1st dose' },
        { n: 'PCV15', d: '1st dose' },
        { n: 'Rotavirus', d: '1st dose' },
      ],
    },
    {
      age: '4 Months',
      v: [
        { n: 'DTaP', d: '2nd dose' },
        { n: 'IPV', d: '2nd dose' },
        { n: 'Hib', d: '2nd dose' },
        { n: 'PCV15', d: '2nd dose' },
        { n: 'Rotavirus', d: '2nd dose' },
      ],
    },
    {
      age: '6 Months',
      v: [
        { n: 'DTaP', d: '3rd dose' },
        { n: 'IPV', d: '3rd dose' },
        { n: 'Hib', d: '3rd dose' },
        { n: 'PCV15', d: '3rd dose' },
        { n: 'Hep B', d: '3rd dose' },
        { n: 'Flu', d: 'Annual (6+ mo)' },
      ],
    },
    {
      age: '9 Months',
      v: [
        { n: 'Hep B', d: '3rd (if not given)' },
        { n: 'Flu', d: '2nd dose (1st season)' },
      ],
    },
    {
      age: '12 Months',
      v: [
        { n: 'MMR', d: '1st dose' },
        { n: 'Varicella', d: '1st dose' },
        { n: 'Hep A', d: '1st dose' },
        { n: 'PCV15', d: 'Booster' },
        { n: 'Hib', d: 'Booster' },
      ],
    },
    {
      age: '15 Months',
      v: [{ n: 'DTaP', d: '4th dose' }],
    },
    {
      age: '18 Months',
      v: [{ n: 'Hep A', d: '2nd dose' }],
    },
  ],
  vaccineSource: 'CDC/ACIP 2026 Recommended Immunization Schedule',

  medicines: {
    antipyretic: {
      name: 'Infant Acetaminophen (Tylenol)',
      genericName: 'Acetaminophen',
      concentrationMg: 160,
      concentrationLabel: '160 mg / 5 mL',
      doseLowPerKg: 10,
      doseHighPerKg: 15,
      frequency: 'Every 4-6 hours as needed',
      maxDoses: 'Max 5 doses in 24 hrs',
      emoji: '\u{1F7E3}',
      minAgeMonths: null,
    },
    antiInflammatory: {
      name: 'Infant Ibuprofen (Advil/Motrin)',
      genericName: 'Ibuprofen',
      concentrationMg: 100,
      concentrationLabel: '100 mg / 5 mL',
      doseLowPerKg: 5,
      doseHighPerKg: 10,
      frequency: 'Every 6-8 hours as needed',
      maxDoses: 'Max 4 doses in 24 hrs',
      emoji: '\u{1F7E0}',
      minAgeMonths: 6,
      ageRestriction: '6+ months only!',
    },
    tips: [
      'Never alternate Tylenol & Motrin without doctor\u2019s OK',
      'Use the syringe that comes with the medicine',
      'Don\u2019t use adult formulations',
      'Fever reducers treat discomfort, not the infection',
      'Call doctor before giving meds to babies under 3 months',
    ],
  },

  feverGuide: [
    {
      age: '0\u20133 months',
      temp: '100.4\u00B0F+ (38\u00B0C+)',
      action: 'CALL DOCTOR IMMEDIATELY or go to ER',
      urgent: true,
      detail: 'Any fever in a newborn is a medical emergency. Do not give medication without doctor\u2019s instruction.',
    },
    {
      age: '3\u20136 months',
      temp: '101\u00B0F+ (38.3\u00B0C+)',
      action: 'Call doctor',
      urgent: true,
      detail: 'Call if fever lasts more than 1 day or baby seems very uncomfortable.',
    },
    {
      age: '6\u201324 months',
      temp: '102\u00B0F+ (38.9\u00B0C+)',
      action: 'Call doctor if lasts 1+ day',
      urgent: false,
      detail: 'Give infant acetaminophen (Tylenol) or ibuprofen (Advil, 6+ mo). Push fluids. Call if fever persists 24+ hrs.',
    },
    {
      age: 'Any age',
      temp: '104\u00B0F+ (40\u00B0C+)',
      action: 'SEEK IMMEDIATE CARE',
      urgent: true,
      detail: 'Very high fever needs medical evaluation regardless of age.',
    },
    {
      age: 'Any age',
      temp: 'Febrile seizure',
      action: 'CALL 911',
      urgent: true,
      detail: 'Lay child on side, don\u2019t put anything in mouth, time the seizure. Call 911 if it lasts more than 5 minutes.',
    },
  ],

  cprSteps: [
    {
      step: 1,
      title: 'Check Responsiveness',
      detail: 'Tap the baby\u2019s foot and shout. If no response, call 911 (or have someone call). Put phone on speaker.',
    },
    {
      step: 2,
      title: 'Open Airway',
      detail: 'Place baby on firm flat surface. Tilt head back slightly with one hand on forehead, lift chin with other hand.',
    },
    {
      step: 3,
      title: 'Check Breathing',
      detail: 'Look, listen, and feel for breathing for no more than 10 seconds. If not breathing normally, begin CPR.',
    },
    {
      step: 4,
      title: 'Give 30 Compressions',
      detail: 'Place 2 fingers on breastbone just below nipple line. Push down 1.5 inches (4 cm), fast \u2014 100-120/min. Let chest fully recoil.',
    },
    {
      step: 5,
      title: 'Give 2 Rescue Breaths',
      detail: 'Cover baby\u2019s mouth AND nose with your mouth. Give 2 gentle puffs (1 second each). Watch for chest rise.',
    },
    {
      step: 6,
      title: 'Continue 30:2 Cycle',
      detail: 'Repeat 30 compressions + 2 breaths. Continue until baby responds, EMS arrives, or you\u2019re too exhausted.',
    },
  ],
  cprDisclaimer: 'This guide is for reference only. Please take a certified infant CPR class through the American Red Cross or American Heart Association.',

  chokingSteps: [
    {
      step: 1,
      title: 'Assess the Situation',
      detail: 'If baby can cough or cry, let them try to clear it. If baby cannot breathe, cry, or cough \u2014 act NOW.',
    },
    {
      step: 2,
      title: '5 Back Blows',
      detail: 'Hold baby face-down on your forearm, head lower than body. Support head with your hand. Give 5 firm back blows between shoulder blades with heel of your hand.',
    },
    {
      step: 3,
      title: '5 Chest Thrusts',
      detail: 'Turn baby face-up on your forearm. Place 2 fingers on breastbone just below nipple line. Give 5 quick chest thrusts (push down 1.5 inches).',
    },
    {
      step: 4,
      title: 'Check Mouth',
      detail: 'Look in baby\u2019s mouth. If you SEE the object, sweep it out with a finger. Do NOT do blind finger sweeps.',
    },
    {
      step: 5,
      title: 'Repeat Until Clear',
      detail: 'Alternate 5 back blows and 5 chest thrusts until object comes out, baby can breathe, or baby becomes unconscious.',
    },
    {
      step: 6,
      title: 'If Unconscious',
      detail: 'Call 911 if not done already. Begin infant CPR (30 compressions, 2 breaths). Check mouth before each set of breaths.',
    },
  ],

  safety: [
    {
      t: 'Safe Sleep (ABCs)',
      icon: 'shield',
      c: '#FF6B8A',
      items: [
        'Alone, Back, Crib',
        'No bumpers/blankets/toys',
        'Room-share 6+ months',
        'Pacifier reduces SIDS',
        'Temp 68-72\u00B0F',
      ],
    },
    {
      t: 'Baby-Proofing',
      icon: 'home',
      c: '#6C63FF',
      items: [
        'Cover outlets',
        'Anchor furniture',
        'Gates at stairs',
        'Lock cabinets',
        'Small objects off floor',
        'Blind cords up high',
      ],
    },
    {
      t: 'Car Safety',
      icon: 'shield',
      c: '#00C9A7',
      items: [
        'Rear-facing until age 2+',
        'Back seat always',
        'Never alone in car',
        'Snug harness',
        'Register for recalls',
      ],
    },
    {
      t: 'Choking Prevention',
      icon: 'alert-triangle',
      c: '#FFB347',
      items: [
        'Quarter grapes/tomatoes',
        'No whole nuts/popcorn',
        'No raw carrots/hot dogs',
        'Pea-sized pieces',
        'Supervise all meals',
        'Learn infant CPR!',
      ],
    },
    {
      t: 'Water Safety',
      icon: 'droplets',
      c: '#42A5F5',
      items: [
        'Never unattended near water',
        '1 inch can drown',
        'Empty buckets',
        'Fence pools',
        'Designate water watcher',
      ],
    },
    {
      t: 'Sun & Heat',
      icon: 'sun',
      c: '#FFB347',
      items: [
        'Under 6 mo: shade only',
        '6+ mo: SPF 30+',
        'Long sleeves, hat',
        'Avoid 10AM-4PM',
        'Never in parked car',
      ],
    },
  ],

  visits: [
    { a: '3-5 Days', f: 'Weight, jaundice, feeding' },
    { a: '1 Month', f: 'Growth, feeding, development' },
    { a: '2 Months', f: 'Vaccinations, tummy time' },
    { a: '4 Months', f: 'Vaccinations, solids readiness' },
    { a: '6 Months', f: 'Vaccinations, starting solids' },
    { a: '9 Months', f: 'Developmental screening' },
    { a: '12 Months', f: 'Vaccinations, whole milk, lead' },
    { a: '15 Months', f: 'Vaccinations, language' },
    { a: '18 Months', f: 'Autism screening (M-CHAT)' },
    { a: '24 Months', f: 'Autism screening, dental' },
  ],

  formulaNotes: [
    {
      r: 'Start with standard cow\u2019s milk formula',
      d: 'AAP recommends this as the default for non-breastfed babies. It works for 80%+ of infants.',
    },
    {
      r: 'Generic/store brands are fine',
      d: 'All formula sold in the US meets strict FDA standards. Generic brands have the same nutrients at lower cost.',
    },
    {
      r: 'Check for iron fortification',
      d: 'All infant formula should be iron-fortified. Low-iron formula is not recommended by AAP.',
    },
  ],

  remedyBrands: {
    gasDrops: 'Mylicon/Little Remedies',
    diaperCream: 'Aquaphor/Desitin',
    feverReducer: 'Tylenol',
  },
};
