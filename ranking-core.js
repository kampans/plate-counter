const rankAgeCategories = [
  ["SJ", "Sub-Junior (14 to 18)", 18],
  ["JR", "Junior (19 to 23)", 23],
  ["OPEN", "Open (24 to 39)", 39],
  ["M1", "Masters 1 (40 to 49)", 49],
  ["M2", "Masters 2 (50 to 59)", 59],
  ["M3", "Masters 3 (60 to 69)", 69],
  ["M4", "Masters 4 (70 and over)", Infinity]
];

function ageToCategory(age) {
  if (!Number.isFinite(age) || age < 14) return null;
  return rankAgeCategories.find(([, , maximum]) => age <= maximum)[0];
}

function rankingScores(sex, bodyweight, total, equipment) {
  const division = sex === "M" ? "men" : "women";
  return {
    dots: Math.round(calculateDots(bodyweight, total, division) * 100),
    // Match the OPL export precision and minimum weight for cohort comparisons.
    gl: equipment === "Raw" && bodyweight >= 35
      ? Math.round(total * glCoefficient(bodyweight, division, "full", "classic") * 100)
      : null
  };
}

function scoreBoundary(scores, score, includeEqual) {
  let start = 0;
  let end = scores.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (scores[middle] < score || (includeEqual && scores[middle] === score)) start = middle + 1;
    else end = middle;
  }
  return start;
}

function rankIn(scores, score) {
  const size = scores.length;
  if (size === 0) return null;

  const below = scoreBoundary(scores, score, false);
  const above = size - scoreBoundary(scores, score, true);
  const ties = size - below - above;
  const percentileBelow = (below + ties / 2) / size * 100;
  return { rank: above + 1, size, percentileBelow, top: Math.max(0.1, 100 - percentileBelow) };
}

function nearbyRankingRows(scores, score) {
  const split = scoreBoundary(scores, score, true);
  const above = scores.slice(split, split + 5).reverse();
  const below = scores.slice(Math.max(0, split - 5), split).reverse();
  const rowsFor = entries => entries.map(value => ({
    score: value,
    rank: scores.length - scoreBoundary(scores, value, true) + (value < score ? 2 : 1)
  }));
  return [
    ...rowsFor(above),
    { score, rank: scores.length - split + 1, isUser: true },
    ...rowsFor(below)
  ];
}
