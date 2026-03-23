/**
 * Positive encouragement messages shown after quick-log actions.
 * Each category has a pool of messages; one is picked at random.
 */

const ENCOURAGEMENTS: Record<string, string[]> = {
  feed: [
    'You are doing amazing, mama!',
    'Every feed helps your baby grow stronger!',
    'Nourishing your little one - great job!',
    'What a wonderful mama you are!',
    'Your baby is so lucky to have you!',
    'Feeding time = love time!',
    'You are giving your baby the best start!',
  ],
  diaper: [
    'Clean & comfy - you are the best!',
    'Another change, another hug!',
    'You are keeping baby so comfortable!',
    'Great job staying on top of things!',
    'Your care makes all the difference!',
    'Happy baby, happy mama!',
  ],
  sleep: [
    'Sweet dreams for your little one!',
    'Rest is so important - well done!',
    'You are helping baby build healthy habits!',
    'Your baby feels safe because of you!',
    'Peaceful sleep thanks to a loving mama!',
    'You are doing a wonderful job!',
  ],
  wake: [
    'Good morning, little sunshine!',
    'A well-rested baby is a happy baby!',
    'Ready for a new adventure together!',
    'Rise and shine - you have got this, mama!',
    'Another beautiful day with your baby!',
  ],
  tummy: [
    'Tummy time superstar!',
    'Building those strong muscles!',
    'You are helping baby grow stronger!',
    'Great job encouraging development!',
    'Every minute of tummy time counts!',
  ],
};

/** Pick a random encouragement for the given quick-log category. */
export function getEncouragement(cat: string, subType?: string): string {
  let key = cat;
  if (cat === 'sleep' && subType === 'Wake Up') key = 'wake';
  const pool = ENCOURAGEMENTS[key] || ENCOURAGEMENTS['feed'];
  return pool[Math.floor(Math.random() * pool.length)];
}
