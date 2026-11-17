const warmupForm = document.getElementById("warmup-form");
const warmupWeight = document.getElementById("top-weight");
const warmupReps = document.getElementById("top-reps");
const warmupResult = document.getElementById("warmup-result");
const warmupBar = window.PLATE_COUNTER_CONFIG.barWeight;
const warmupIncrement = Math.min(...window.PLATE_COUNTER_CONFIG.plates.map(plate => plate.weight)) * 2;
warmupWeight.min = warmupBar;
warmupWeight.step = warmupIncrement;

warmupForm.addEventListener("submit", event => {
  event.preventDefault();
  const target = Number(warmupWeight.value);
  const reps = Number(warmupReps.value);
  const steps = (target - warmupBar) / warmupIncrement;
  if (!Number.isFinite(target) || target < warmupBar || Math.abs(steps - Math.round(steps)) > 1e-8 || !Number.isInteger(reps) || reps < 1 || reps > 30) {
    warmupResult.textContent = `Enter a weight of at least ${warmupBar} kg in ${warmupIncrement} kg increments and 1–30 reps.`;
    return;
  }
  const percentages = [0, 0.33, 0.5, 0.65, 0.8, 0.9];
  const warmups = [];
  percentages.forEach((percentage, index) => {
    const load = index === 0 ? warmupBar : warmupBar + Math.round((target * percentage - warmupBar) / warmupIncrement) * warmupIncrement;
    if (load < warmupBar || load >= target || warmups.some(item => item.load === load)) return;
    const repOptions = reps >= 5 ? [5, 5, 5, 3, 2, 1] : [5, 5, 3, 3, 2, 1];
    warmups.push({ load, reps: repOptions[index] });
  });
  warmupResult.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = "Your warm-up";
  const list = document.createElement("ol");
  list.className = "warmup-list";
  warmups.forEach((set, index) => {
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
  warmupResult.append(title, list);
  if (warmups.length < 6) {
    const note = document.createElement("p");
    note.className = "warmup-short";
    note.textContent = "Fewer steps are shown because there are not enough distinct plate increments below this weight.";
    warmupResult.appendChild(note);
  }
});
