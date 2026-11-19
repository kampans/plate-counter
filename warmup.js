const warmupForm = document.getElementById("warmup-form");
const warmupWeight = document.getElementById("top-weight");
const warmupReps = document.getElementById("top-reps");
const warmupResult = document.getElementById("warmup-result");
const warmupBar = window.PLATE_COUNTER_CONFIG.barWeight;
const warmupIncrement = Math.min(...window.PLATE_COUNTER_CONFIG.plates.map(plate => plate.weight)) * 2;

const warmupBands = {
  heavy: { maxReps: 3, template: [[0.4, 5], [0.6, 3], [0.75, 2], [0.9, 1]] },
  moderate: { maxReps: 10, template: [[0.4, 5], [0.65, 3], [0.85, 1]] },
  light: { maxReps: Infinity, template: [[0.5, 5], [0.8, 2]] }
};

function buildWarmup(weight, reps, { bar = 20, step = 2.5 } = {}) {
  if (weight <= bar) return { sets: [], band: null, e1rm: null };

  // Epley assumes a set to failure. A submaximal set can underestimate 1RM,
  // favoring a longer ramp. Rep-to-intensity relationships vary by lifter and lift.
  const e1rm = reps === 1 ? weight : weight * (1 + reps / 30);
  const [band, { template }] = Object.entries(warmupBands).find(([, entry]) => reps <= entry.maxReps);
  // These percentages are of the top-set weight and approximate a progressive ramp.
  const sets = [];
  const seen = new Set();
  for (const [percentage, setReps] of template) {
    const load = Math.max(bar, Math.round(weight * percentage / step) * step);
    if (weight - load <= step || seen.has(load)) continue;
    seen.add(load);
    sets.push({ load, reps: setReps });
  }
  return { sets, band, e1rm };
}

warmupForm.addEventListener("submit", event => {
  event.preventDefault();
  const target = Number(warmupWeight.value);
  const reps = Number(warmupReps.value);
  if (!Number.isFinite(target) || target <= 0 || !Number.isInteger(reps) || reps < 1) {
    warmupResult.textContent = "Enter a positive weight and a whole number of reps (at least 1).";
    return;
  }
  const { sets } = buildWarmup(target, reps, { bar: warmupBar, step: warmupIncrement });
  warmupResult.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = "Your warm-up";
  warmupResult.appendChild(title);
  if (sets.length === 0) {
    const note = document.createElement("p");
    note.className = "warmup-short";
    note.textContent = "No warm-up sets fit below this top-set weight.";
    warmupResult.appendChild(note);
  }
  const list = document.createElement("ol");
  list.className = "warmup-list";
  sets.forEach((set, index) => {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `Warm-up ${index + 1}`;
    const detail = document.createElement("strong");
    detail.textContent = `${set.load} kg × ${set.reps}`;
    row.append(label, detail);
    list.appendChild(row);
  });
  const top = document.createElement("li");
  top.className = "top-set";
  const label = document.createElement("span");
  label.textContent = "Top set";
  const detail = document.createElement("strong");
  detail.textContent = `${target} kg × ${reps}`;
  top.append(label, detail);
  list.appendChild(top);
  warmupResult.appendChild(list);
});
