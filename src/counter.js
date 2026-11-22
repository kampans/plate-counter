const config = window.PLATE_COUNTER_CONFIG;
const history = [];
const totalDisplay = document.getElementById("total");
const perSideDisplay = document.getElementById("per-side");
const plateStack = document.getElementById("plate-stack");
const undo = document.getElementById("undo");
const clear = document.getElementById("clear");
const targetWeight = document.getElementById("target-weight");
const compLoad = document.getElementById("comp-load");
const barType = document.getElementById("bar-type");
const barWeightDisplay = document.getElementById("bar-weight");
const barbellWeightDisplay = document.getElementById("barbell-weight");
const shareBarbell = document.getElementById("share-barbell");
const downloadBarbell = document.getElementById("download-barbell");
const shareStatus = document.getElementById("share-status");
const barbellVisual = document.querySelector(".barbell");
let shareFeedbackTimer;
let barWeight = config.barWeight;
const targetStatus = document.getElementById("target-status");
const platesByWeight = [...config.plates].sort((a, b) => b.weight - a.weight);
const targetStep = 2 * platesByWeight.at(-1).weight;
const maxTarget = 2000;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let totalAnimationFrame;
let previousTotal = Number(totalDisplay.textContent);
function formatWeight(weight) { return Number(weight.toFixed(2)).toString(); }

function updateTotal(total) {
  cancelAnimationFrame(totalAnimationFrame);
  const nextTotal = Number(total);
  const start = Number(totalDisplay.textContent);
  const increase = nextTotal - start;
  const isIncreasing = nextTotal > previousTotal;
  previousTotal = nextTotal;
  if (!isIncreasing || reducedMotion.matches) {
    totalDisplay.textContent = total;
    return;
  }

  const startedAt = performance.now();
  function tick(now) {
    const progress = Math.min((now - startedAt) / 240, 1);
    if (progress >= 1) {
      totalDisplay.textContent = total;
      return;
    }
    totalDisplay.textContent = formatWeight(start + Math.floor(increase * progress));
    totalAnimationFrame = requestAnimationFrame(tick);
  }
  totalAnimationFrame = requestAnimationFrame(tick);
}

function applyTarget() {
  targetStatus.textContent = "";
  if (targetWeight.value === "" && !targetWeight.validity.badInput) return;

  const target = targetWeight.valueAsNumber;
  const collarWeight = compLoad.checked ? 2 * config.collar.weight : 0;
  const minimum = barWeight + collarWeight;
  const incrementCount = (target - minimum) / targetStep;
  if (!Number.isInteger(incrementCount) || target < minimum || target > maxTarget) {
    targetStatus.textContent = `Enter ${minimum}–${maxTarget} kg in ${targetStep} kg steps.`;
    return;
  }

  let remaining = (target - minimum) / 2;
  const load = [];
  for (const plate of platesByWeight) {
    const pairs = Math.floor(remaining / plate.weight);
    remaining -= pairs * plate.weight;
    for (let i = 0; i < pairs; i++) load.push(plate);
  }
  if (remaining !== 0) {
    targetStatus.textContent = "This weight cannot be loaded with the available plates.";
    return;
  }
  if (compLoad.checked) load.push(config.collar);
  history.splice(0, history.length, ...load);
  render();
  return true;
}

function resetTarget() {
  targetWeight.value = "";
  targetStatus.textContent = "";
}

function render() {
  const counts = new Map();
  let perSide = 0;
  for (const plate of history) {
    perSide += plate.weight;
    counts.set(plate, (counts.get(plate) ?? 0) + 1);
  }
  const total = formatWeight(barWeight + perSide * 2);
  barWeightDisplay.textContent = barbellWeightDisplay.textContent = formatWeight(barWeight);
  updateTotal(total);
  document.getElementById("total-announcement").textContent = `Total weight: ${total} kilograms`;
  perSideDisplay.textContent = formatWeight(perSide);
  const plates = history.filter(item => item !== config.collar);
  const collars = history.filter(item => item === config.collar);
  plateStack.replaceChildren(...[...plates, ...collars].map((plate, index) => {
    const profile = document.createElement("span");
    profile.className = plate === config.collar ? "plate-profile collar-profile" : "plate-profile";
    if (plate.color) profile.style.setProperty("--plate-color", plate.color);
    profile.style.setProperty("--diameter", plate.diameter);
    profile.style.setProperty("--thickness", plate.thickness);
    if (plate !== config.collar) {
      const weightLabel = document.createElement("span");
      weightLabel.className = "plate-weight";
      if (plate.weight === 2.5 || plate.weight === 1.25) {
        weightLabel.classList.add("plate-weight-stacked");
      }
      weightLabel.textContent = formatWeight(plate.weight);
      weightLabel.style.color = plate.labelColor ?? plate.textColor;
      const number = document.createElement("span");
      number.className = "plate-number";
      number.textContent = index + 1;
      number.style.color = plate.textColor;
      profile.append(weightLabel, number);
    }
    return profile;
  }));
  choices.forEach(({ item, countLabel }) => {
    const count = counts.get(item) ?? 0;
    countLabel.textContent = count > 0 ? `${count} per side` : "";
  });
  undo.disabled = clear.disabled = history.length === 0;
}
const barWeights = [...new Set([15, 20, 25, config.barWeight])].sort((a, b) => a - b);
barType.replaceChildren(...barWeights.map(weight => new Option(`${formatWeight(weight)} kg`, weight)));
barType.value = String(barWeight);
const choices = [...config.plates, config.collar].map(item => {
  const isCollar = item === config.collar;
  const button = document.createElement("button");
  button.type = "button";
  button.className = isCollar ? "plate-button collar-button" : "plate-button";
  button.dataset.weight = item.weight;
  if (!isCollar) {
    button.style.setProperty("--plate-color", item.color);
    button.style.setProperty("--plate-text", item.textColor);
  }
  button.setAttribute("aria-label", isCollar
    ? `Add ${item.weight} kg calibrated collar pair`
    : `Add a pair of ${item.weight} kilogram plates`);
  button.innerHTML = `${item.weight}<small>kg</small>`;
  if (isCollar) {
    const tag = document.createElement("span");
    tag.className = "collar-tag";
    tag.textContent = "Collar";
    button.appendChild(tag);
  }
  button.addEventListener("click", () => { resetTarget(); history.push(item); render(); });

  const choice = document.createElement("div");
  choice.className = "plate-choice";
  const countLabel = document.createElement("span");
  countLabel.className = "plate-count";
  choice.append(button, countLabel);
  document.getElementById("plate-buttons").appendChild(choice);
  return { item, countLabel };
});
targetWeight.addEventListener("input", applyTarget);
compLoad.addEventListener("change", applyTarget);
barType.addEventListener("change", () => {
  barWeight = Number(barType.value);
  if (!applyTarget()) render();
});
undo.addEventListener("click", () => { resetTarget(); history.pop(); render(); });
clear.addEventListener("click", () => { resetTarget(); history.length = 0; render(); });
shareBarbell.addEventListener("click", async () => {
  clearTimeout(shareFeedbackTimer);
  delete shareBarbell.dataset.feedback;
  shareBarbell.disabled = true;
  shareStatus.textContent = "";
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("Image clipboard is unavailable.");
    }
    // Start the clipboard write within the click, before PNG encoding finishes.
    const png = createBarbellPng(barbellVisual, `${formatWeight(previousTotal)} kg`);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    shareBarbell.dataset.feedback = "copied";
    shareStatus.textContent = "Barbell PNG copied to clipboard.";
  } catch {
    shareBarbell.dataset.feedback = "error";
    shareStatus.textContent = "Could not copy the image. Use Download to save it.";
  } finally {
    shareBarbell.disabled = false;
    shareFeedbackTimer = setTimeout(() => { delete shareBarbell.dataset.feedback; }, 2500);
  }
});
downloadBarbell.addEventListener("click", async () => {
  downloadBarbell.disabled = true;
  shareStatus.textContent = "";
  const weight = formatWeight(previousTotal);
  try {
    const png = await createBarbellPng(barbellVisual, `${weight} kg`);
    const url = URL.createObjectURL(png);
    const link = document.createElement("a");
    link.href = url;
    link.download = `barbell-${weight}kg.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    shareStatus.textContent = "Barbell PNG download started.";
  } catch {
    shareStatus.textContent = "Could not export the barbell image. Try again.";
  } finally {
    downloadBarbell.disabled = false;
  }
});
render();

