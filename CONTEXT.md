# Warm-up calculator: context, framework and test cases

Use this file as the spec when fixing the warm-up calculator on the plate-counter site.
Only the warm-up logic should change. Keep the UI layout, styling, plate counter and
total-weight maths as they are.

## 1. The bug

The calculator takes a top-set weight and top-set reps, but the reps never affect the
output. It was originally written for a single (1 rep) and the rep input was added later.

Example from the current build, 137.5 kg x 8:

| Set | Weight | Reps | % of top-set weight |
|---|---|---|---|
| Warm-up 1 | 20 | 5 | 15% |
| Warm-up 2 | 45 | 5 | 33% |
| Warm-up 3 | 70 | 5 | 51% |
| Warm-up 4 | 90 | 3 | 65% |
| Warm-up 5 | 110 | 2 | 80% |
| Warm-up 6 | 125 | 1 | 91% |

That is six sets and 21 warm-up reps before an 8-rep set. It is a ramp for a heavy
single. Changing reps from 1 to 12 gives the same output, which is wrong: a 12-rep set
is far lighter relative to a lifter's max than a single, so it needs a much shorter ramp.

## 2. Evidence (what it does and does not support)

Read from abstracts and summaries; full texts were not accessible. Treat the numbers in
section 3 as a design based on these papers, not a result from them.

**Warm-up studies**
- Ribeiro et al. 2020, *Int J Environ Res Public Health*, "The Role of Specific Warm-up
  during Bench Press and Squat Exercises: A Novel Approach"
  (https://pubmed.ncbi.nlm.nih.gov/32971729/). 40 resistance-trained males did 3 x 6 at
  80% of max after one of three warm-ups: 2 x 6 at 40% and 80% of the training load,
  6 x 80%, or 6 x 40%. Squat was best after the 6 x 80% warm-up and bench press after the
  40%/80% combination. Few reps at low loads were not enough. Takeaway: warm-up loads are
  best defined as a percentage of the **training load** (top-set weight), and at least one
  set should be close to it (about 80%).
- Ribeiro et al. 2021, *Journal of Men's Health*
  (https://doi.org/10.31083/jomh.2021.069). A 2 x 6 warm-up at 40% and 80% of the training
  load gave higher bar speed in the first set of squat and bench press than no warm-up.
- Ribeiro et al. 2021, *Motricidade*, "The effect of warm-up in resistance training and
  strength performance: a systematic review"
  (https://www.researchgate.net/publication/354354269_The_effect_of_warm-up_in_resistance_training_and_strength_performance_a_systematic_review).
- "Warming up to improved performance? Effects of different specific warm-up protocols on
  neuromuscular performance in trained individuals" (review; appears to be a preprint, check
  publication status: https://sportrxiv.org/index.php/server/preprint/download/559/1219/1136).
  Studies that found a benefit used 1 to 2 progressively heavier warm-up sets, with at least
  one at 80 to 90% of max. Studies that found no benefit used 1 to 2 sets at only 40 to 60%,
  or a 10/4/2/1 rep scheme at 40/60/70/80% of max.

**Converting reps to relative intensity**
- Nuzzo et al. 2024, *Sports Medicine*, meta-regression of reps-to-failure at percentages of
  1RM, 952 tests, 7,289 people, 269 studies
  (https://link.springer.com/content/pdf/10.1007/s40279-023-01937-7.pdf).
  Exercise type was the only factor that mattered; individual spread is large.
- Epley formula: estimated 1RM = weight x (1 + reps / 30). Secondary sources only; it
  assumes the set was taken to failure.

**Limits**
- Studies are acute-performance studies in young, resistance-trained males, mostly squat
  and bench press. Deadlift and overhead press are not covered.
- No study validates a warm-up calculator. They support the shape (progressive, few sets,
  at least one set near the working weight, low reps near the top), not the exact numbers.

## 3. Framework

Reps decide **how many warm-up sets and how high the ramp goes**. Warm-up weights are always
**percentages of the top-set weight**.

1. Estimate max: `e1rm = reps <= 1 ? weight : weight * (1 + reps / 30)`.
2. Intensity: `I = weight / e1rm` (about 91% at 3 reps, 79% at 8, 75% at 10, 71% at 12).
3. Pick a band from the top-set reps (equivalent to thresholds on I):

| Band | Top-set reps | Intensity I | Warm-up sets (% of top-set weight x reps) |
|---|---|---|---|
| heavy | 1 to 3 | >= 90% | 40% x 5, 60% x 3, 75% x 2, 90% x 1 |
| moderate | 4 to 10 | 75% to < 90% | 40% x 5, 65% x 3, 85% x 1 |
| light | 11 or more | < 75% | 50% x 5, 80% x 2 |

4. Round each weight to the nearest `step` (default 2.5 kg, i.e. 1.25 kg plates on both
   sides; use `Math.round(x / step) * step`).
5. Never go below the bar: `max(bar, rounded)` (bar default 20 kg).
6. Drop a set if it is within `step` of the top-set weight.
7. Drop a set if its weight equals an earlier set's weight (keep the earlier one).
8. If the top-set weight is <= the bar, return no warm-up sets and show a short message.

Reference implementation (adapt to the existing code style):

```js
export function buildWarmup(weight, reps, { bar = 20, step = 2.5 } = {}) {
  if (!(weight > bar) || !(reps >= 1)) return { sets: [], band: null, e1rm: null };
  const e1rm = reps <= 1 ? weight : weight * (1 + reps / 30);
  const band = reps <= 3 ? 'heavy' : reps <= 10 ? 'moderate' : 'light';
  const template = {
    heavy:    [[0.40, 5], [0.60, 3], [0.75, 2], [0.90, 1]],
    moderate: [[0.40, 5], [0.65, 3], [0.85, 1]],
    light:    [[0.50, 5], [0.80, 2]],
  }[band];
  const seen = new Set();
  const sets = [];
  for (const [pct, r] of template) {
    const w = Math.max(bar, Math.round((weight * pct) / step) * step);
    if (weight - w <= step || seen.has(w)) continue;
    seen.add(w);
    sets.push({ weight: w, reps: r });
  }
  return { sets, band, e1rm };
}
```

Keep the thresholds, percentages and reps in a config object so they are easy to tune.

## 4. Test vectors

All use bar = 20 kg, step = 2.5 kg. These were computed with an equivalent reference
implementation; check the JS against them.

| Top set | Band | Warm-up sets (kg x reps) |
|---|---|---|
| 137.5 x 8 | moderate | 55x5, 90x3, 117.5x1 |
| 140 x 1 | heavy | 55x5, 85x3, 105x2, 125x1 |
| 140 x 12 | light | 70x5, 112.5x2 |
| 100 x 5 | moderate | 40x5, 65x3, 85x1 |
| 200 x 3 | heavy | 80x5, 120x3, 150x2, 180x1 |
| 60 x 10 | moderate | 25x5, 40x3, 50x1 |
| 100 x 15 | light | 50x5, 80x2 |
| 102.5 x 4 | moderate | 40x5, 67.5x3, 87.5x1 |
| 60 x 1 | heavy | 25x5, 35x3, 45x2, 55x1 |
| 30 x 8 | moderate | 20x5, 25x1 |
| 25 x 1 | heavy | 20x5 |
| 22.5 x 5 | moderate | none (top set is within one step of the bar) |

Regression check: for the same weight, changing reps from 1 to 5 to 12 must change the
number of sets and the ramp (heavy, moderate, light). Reps 3 vs 4 and 10 vs 11 are the band
boundaries.

## 5. Behaviour and UI notes

- Show the sets as they are shown now; the top set stays the last row.
- If there are no warm-up sets, show a one-line message instead of an empty list.
- Update the helper text to "Keep warm-up sets easy. Rest as needed, especially before your
  top set." (unchanged) and optionally add a small line such as "Heavy / Moderate / Light top
  set" under the inputs. Do not show estimated max unless asked.
- Validate inputs: weight > 0, reps a whole number >= 1; ignore other values.
- Do not touch the plate counter or the "loaded on both sides" label.

## 6. Caveats to keep in comments

- Epley assumes the top set was taken to failure. If it was not, the estimate is low, so the
  ramp errs toward more warm-up, which is the safer direction.
- Rep-to-percentage relationships vary a lot between people and lifts, so the bands are
  deliberately coarse.
- Percentages are of the top-set weight, while the studies mostly refer to max or training
  load; they are an approximation, not a validated protocol.
