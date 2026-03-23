/**
 * Recommended vaccine schedule from birth to 18 months
 * Based on CDC/AAP guidelines
 */

export interface Vaccine {
  n: string;  // vaccine name
  d: string;  // dose description
}

export interface VaccineSchedule {
  age: string;
  v: Vaccine[];
}

export const VACCINES: VaccineSchedule[] = [
  {
    age: "Birth",
    v: [{ n: "Hepatitis B", d: "1st dose" }],
  },
  {
    age: "1 Month",
    v: [{ n: "Hepatitis B", d: "2nd dose" }],
  },
  {
    age: "2 Months",
    v: [
      { n: "DTaP", d: "1st dose" },
      { n: "IPV (Polio)", d: "1st dose" },
      { n: "Hib", d: "1st dose" },
      { n: "PCV15", d: "1st dose" },
      { n: "Rotavirus", d: "1st dose" },
    ],
  },
  {
    age: "4 Months",
    v: [
      { n: "DTaP", d: "2nd dose" },
      { n: "IPV", d: "2nd dose" },
      { n: "Hib", d: "2nd dose" },
      { n: "PCV15", d: "2nd dose" },
      { n: "Rotavirus", d: "2nd dose" },
    ],
  },
  {
    age: "6 Months",
    v: [
      { n: "DTaP", d: "3rd dose" },
      { n: "IPV", d: "3rd dose" },
      { n: "Hib", d: "3rd dose" },
      { n: "PCV15", d: "3rd dose" },
      { n: "Hep B", d: "3rd dose" },
      { n: "Flu", d: "Annual (6+ mo)" },
    ],
  },
  {
    age: "9 Months",
    v: [
      { n: "Hep B", d: "3rd (if not given)" },
      { n: "Flu", d: "2nd dose (1st season)" },
    ],
  },
  {
    age: "12 Months",
    v: [
      { n: "MMR", d: "1st dose" },
      { n: "Varicella", d: "1st dose" },
      { n: "Hep A", d: "1st dose" },
      { n: "PCV15", d: "Booster" },
      { n: "Hib", d: "Booster" },
    ],
  },
  {
    age: "15 Months",
    v: [{ n: "DTaP", d: "4th dose" }],
  },
  {
    age: "18 Months",
    v: [{ n: "Hep A", d: "2nd dose" }],
  },
];
