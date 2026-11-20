const rankForm = document.getElementById("rank-form");
const {
  federation, sex, age, bodyweight, equipment, scoring, category: ageGroup, allAges, squat, bench, deadlift
} = rankForm.elements;
const rankSubmit = document.getElementById("rank-submit");
const rankTotal = document.getElementById("rank-total");
const rankStatus = document.getElementById("rank-status");
const rankResults = document.getElementById("rank-results");
const rankDataDate = document.getElementById("rank-data-date");
const rankAgeOptions = document.getElementById("rank-age-options");
const rankAgeCoverage = document.getElementById("rank-age-coverage");
const rankDataRoot = "data/rankings/";
const rankFiles = new Map();
const rankLifts = [squat, bench, deadlift];
const rankNumbers = [age, bodyweight, ...rankLifts];
const redPlate = window.PLATE_COUNTER_CONFIG.plates.find(plate => plate.weight === 25);
if (redPlate) rankSubmit.style.setProperty("--rank-red", redPlate.color);

let rankManifest;
let rankFederation;
let rankData;
let rankLoadError = "";
let rankLoading = true;
let rankRequest = 0;

for (const [key, label] of rankAgeCategories) ageGroup.add(new Option(label, key));

async function rankJson(filename) {
  const response = await fetch(rankDataRoot + filename);
  if (!response.ok) throw new Error(`Ranking data returned ${response.status}`);
  return response.json();
}

function ageLabel(key) {
  return rankAgeCategories.find(([category]) => category === key)?.[1] ?? "All ages";
}

function updateEquipment() {
  const selected = equipment.value;
  const options = rankData?.equipment.filter(item =>
    !sex.value || rankData.cohorts[`${sex.value}|${item}|ALL`]
  ) ?? [];

  equipment.replaceChildren(...options.map(item => new Option(item, item)));
  equipment.disabled = options.length === 0;
  if (equipment.disabled) equipment.add(new Option("No equipment available", ""));
  else equipment.value = options.includes(selected) ? selected : options.includes("Raw") ? "Raw" : options[0];
}

function totalLifts() {
  return rankLifts.reduce((total, field) => total + (field.valueAsNumber || 0), 0);
}

function updateRankForm() {
  const glOption = scoring.querySelector('option[value="gl"]');
  glOption.disabled = equipment.value !== "Raw";
  if (glOption.disabled && scoring.value === "gl") scoring.value = "dots";

  const derived = ageToCategory(age.valueAsNumber);
  ageGroup.options[0].textContent = derived ? `Use entered age: ${ageLabel(derived)}` : "Use entered age";
  ageGroup.disabled = allAges.checked;
  rankTotal.value = `Total: ${totalLifts()} kg`;
  const invalid = rankNumbers.find(field => field.validity.badInput || (field.value && !field.validity.valid));
  for (const field of rankNumbers) {
    field.setAttribute("aria-invalid", String(field.validity.badInput || Boolean(field.value && !field.validity.valid)));
  }
  rankStatus.textContent = rankLoadError || (rankLoading ? "Loading ranking data…" :
    invalid ? invalid.validationMessage : "");
  rankSubmit.disabled = !rankData || !equipment.value || !rankForm.checkValidity();
  rankResults.replaceChildren();
}

async function loadFederation() {
  const request = ++rankRequest;
  rankFederation = rankManifest.federations.find(item => item.id === federation.value);
  rankData = null;
  rankLoadError = "";
  rankLoading = Boolean(rankFederation);
  rankAgeOptions.hidden = true;
  rankAgeCoverage.hidden = true;
  ageGroup.value = "";
  allAges.checked = Boolean(rankFederation?.defaultAllAges);
  updateEquipment();
  updateRankForm();
  if (!rankFederation) return;

  const { file, ageReliable } = rankFederation;
  try {
    if (!rankFiles.has(file)) rankFiles.set(file, await rankJson(file));
    if (request !== rankRequest) return;
    rankData = rankFiles.get(file);
    rankAgeOptions.hidden = !ageReliable;
    rankAgeCoverage.hidden = ageReliable;
    updateEquipment();
  } catch {
    if (request !== rankRequest) return;
    federation.value = "";
    rankLoadError = "Could not load this federation. Select it again to retry.";
  }
  rankLoading = false;
  updateRankForm();
}

async function startRanking() {
  try {
    rankManifest = await rankJson("manifest.json");
    federation.replaceChildren(
      new Option("Select federation", ""),
      ...rankManifest.federations.map(item => new Option(item.label, item.id))
    );
    federation.disabled = rankManifest.federations.length === 0;
    if (federation.disabled) rankLoadError = "No federation rankings are available.";
    rankDataDate.textContent = `Data as of ${rankManifest.dataAsOf}.`;
  } catch {
    federation.options[0].textContent = "Unavailable";
    rankLoadError = "Could not load ranking data. Reload the page to retry.";
  }
  rankLoading = false;
  updateRankForm();
}

function rankMetric(name, score, distribution, lifterIndexes, category, submitted) {
  const section = document.createElement("section");
  const summary = document.createElement("p");
  section.append(summary);
  const placement = rankIn(distribution, score);
  const text = `${name}: ${(score / 100).toFixed(2)}`;
  if (!placement || placement.size < 5) {
    const suggestion = category === "ALL" ? "" : " Try comparing to all ages.";
    const size = placement?.size ?? 0;
    summary.textContent = `${text} · Not enough data (${size} ${size === 1 ? "lifter" : "lifters"}).${suggestion}`;
    return section;
  }
  const { rank, size, top } = placement;
  const note = size < 20 ? "Small group, treat this as rough." : `Top ${top.toFixed(1)}%`;
  summary.textContent = `${text} · #${rank} of ${size} · ${note}`;

  const table = document.createElement("table");
  table.className = "rank-neighbors";
  table.createCaption().textContent = `Nearby ${name} rankings (lifts in kg)`;
  const header = table.createTHead().insertRow();
  for (const label of ["Rank", "Lifter", "Squat", "Bench", "Deadlift", "Total", name]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of nearbyRankingRows(distribution, score)) {
    const entry = body.insertRow();
    entry.classList.toggle("rank-your-row", Boolean(row.isUser));
    const lifter = row.isUser ? submitted : rankData.lifters?.[lifterIndexes?.[row.index]];
    entry.insertCell().textContent = `#${row.rank}`;
    entry.insertCell().textContent = lifter?.name ?? "Lifter";
    for (const lift of ["squat", "bench", "deadlift", "total"]) {
      entry.insertCell().textContent = lifter?.[lift] ?? "—";
    }
    entry.insertCell().textContent = (row.score / 100).toFixed(2);
  }
  const scroll = document.createElement("div");
  scroll.className = "rank-table-scroll";
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", `Nearby ${name} rankings`);
  scroll.append(table);
  section.append(scroll);
  return section;
}

rankForm.addEventListener("input", event => {
  if (event.target === federation) return;
  const refreshResults = event.target === scoring && rankResults.hasChildNodes();
  if (event.target === sex) updateEquipment();
  updateRankForm();
  if (refreshResults && !rankSubmit.disabled) showRanking();
});
federation.addEventListener("change", loadFederation);
rankForm.addEventListener("submit", event => {
  event.preventDefault();
  if (rankSubmit.disabled || !rankForm.checkValidity()) return;
  showRanking();
});

function showRanking() {
  const total = totalLifts();
  const category = allAges.checked || !rankFederation.ageReliable ? "ALL" :
    ageGroup.value || ageToCategory(age.valueAsNumber);
  const scores = rankingScores(sex.value, bodyweight.valueAsNumber, total, equipment.value);
  const cohort = rankData.cohorts[`${sex.value}|${equipment.value}|${category}`] ?? { dots: [], gl: [] };
  const group = document.createElement("h3");
  group.textContent = [sex.selectedOptions[0].textContent, equipment.value, ageLabel(category), rankFederation.label].join(", ");
  const resultTotal = document.createElement("p");
  resultTotal.textContent = `Total: ${total} kg`;
  const metric = scoring.value;
  const label = metric === "gl" ? "IPF GL Points" : "DOTS";
  const submitted = {
    name: "You",
    squat: squat.valueAsNumber,
    bench: bench.valueAsNumber,
    deadlift: deadlift.valueAsNumber,
    total
  };
  const ranking = rankMetric(label, scores[metric], cohort[metric], cohort[`${metric}Lifters`], category, submitted);
  rankResults.replaceChildren(group, resultTotal, ranking);
}

updateRankForm();
startRanking();
