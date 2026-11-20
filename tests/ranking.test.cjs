const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { createContext, runInContext } = require("node:vm");

const context = createContext({});
for (const file of ["score-formulas.js", "ranking-core.js"]) {
  runInContext(readFileSync(join(__dirname, "..", file), "utf8"), context);
}
const { ageToCategory, rankingScores, rankIn, nearbyRankingRows } = context;

test("calendar-year age category boundaries", () => {
  for (const [age, expected] of [
    [13, null], [14, "SJ"], [18, "SJ"], [19, "JR"], [23, "JR"], [24, "OPEN"], [39, "OPEN"],
    [40, "M1"], [49, "M1"], [50, "M2"], [59, "M2"], [60, "M3"], [69, "M3"], [70, "M4"]
  ]) assert.equal(ageToCategory(age), expected);
});

test("binary search handles ties, ranking extremes and empty cohorts", () => {
  const scores = [10000, 20000, 20000, 30000];
  const tied = rankIn(scores, 20000);
  assert.equal(tied.rank, 2);
  assert.equal(tied.percentileBelow, 50);
  assert.equal(rankIn(scores, 5000).rank, 5);
  assert.equal(rankIn(scores, 35000).rank, 1);
  assert.equal(rankIn(scores, 35000).top, 0.1);
  assert.equal(rankIn([], 20000), null);
});

test("nearby rows include up to five entries on each side of the highlighted score", () => {
  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const rows = nearbyRankingRows(scores, 6.5);
  assert.deepEqual(Array.from(rows, row => row.score), [11, 10, 9, 8, 7, 6.5, 6, 5, 4, 3, 2]);
  for (const row of rows.filter(row => !row.isUser)) assert.equal(scores[row.index], row.score);
  assert.equal(rows[5].isUser, true);
  assert.equal(rows[5].rank, 7);
  assert.equal(rows[6].rank, 8);
  assert.equal(nearbyRankingRows(scores, 13)[0].isUser, true);
  assert.equal(nearbyRankingRows(scores, 0).at(-1).isUser, true);
  assert.deepEqual(Array.from(nearbyRankingRows([1, 2, 2, 3], 2), row => row.rank), [1, 2, 2, 2, 5]);
});

test("raw scoring uses OPL hundredths and GL is raw-only", () => {
  const vectors = [
    ["M", 90, 600, 38796, 7977],
    ["F", 63, 350, 37643, 7657],
    ["M", 83, 500, 33754, 6921],
    ["F", 57, 400, 45828, 9383],
    ["M", 105, 700, 42217, 8642]
  ];
  for (const [sex, bodyweight, total, dots, gl] of vectors) {
    const scores = rankingScores(sex, bodyweight, total, "Raw");
    assert.ok(Math.abs(scores.dots - dots) <= 1, JSON.stringify({ sex, bodyweight, total, scores }));
    assert.ok(Math.abs(scores.gl - gl) <= 1, JSON.stringify({ sex, bodyweight, total, scores }));
    assert.equal(rankingScores(sex, bodyweight, total, "Wraps").gl, null);
  }
});
