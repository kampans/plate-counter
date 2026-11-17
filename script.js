const config = window.PLATE_COUNTER_CONFIG;
const history = [];
const totalDisplay = document.getElementById("total");
const perSideDisplay = document.getElementById("per-side");
const undo = document.getElementById("undo");
const clear = document.getElementById("clear");
let displayedTotal = config.barWeight;
let animationFrame;

// The scene module installs these hooks after loading; the counter also works without it.
window.addPlate = window.addPlate || function () {};
window.removePlate = window.removePlate || function () {};

function formatWeight(weight) { return Number(weight.toFixed(2)).toString(); }
function animateTotal(target) {
  cancelAnimationFrame(animationFrame);
  const start = displayedTotal;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    displayedTotal = target;
    totalDisplay.textContent = formatWeight(target);
    return;
  }
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / 350, 1);
    displayedTotal = start + (target - start) * (1 - Math.pow(1 - progress, 3));
    totalDisplay.textContent = formatWeight(displayedTotal);
    if (progress < 1) animationFrame = requestAnimationFrame(tick);
  }
  animationFrame = requestAnimationFrame(tick);
}
function render() {
  const perSide = history.reduce((sum, weight) => sum + weight, 0);
  const total = config.barWeight + perSide * 2;
  animateTotal(total);
  document.getElementById("total-announcement").textContent = `Total weight: ${formatWeight(total)} kilograms`;
  perSideDisplay.textContent = `${formatWeight(perSide)} kg`;
  document.querySelectorAll(".plate-choice").forEach((choice) => { const count = history.filter(item => item === Number(choice.dataset.weight)).length; choice.querySelector(".plate-count").textContent = `${count} per side`; });
  undo.disabled = clear.disabled = history.length === 0;
}
document.getElementById("bar-weight").textContent = `${formatWeight(config.barWeight)} kg`;
config.plates.forEach((plate) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "plate-button";
  button.style.setProperty("--plate-color", plate.color);
  button.style.setProperty("--plate-text", plate.textColor);
  button.setAttribute("aria-label", `Add a pair of ${plate.weight} kilogram plates`);
  button.innerHTML = `${plate.weight}<small>kg</small>`;
  button.addEventListener("click", () => { history.push(plate.weight); window.addPlate(plate.weight); render(); });
  const choice = document.createElement("div"); choice.className = "plate-choice"; choice.dataset.weight = plate.weight; const count = document.createElement("span"); count.className = "plate-count"; choice.append(button, count); document.getElementById("plate-buttons").appendChild(choice);
});
undo.addEventListener("click", () => { if (history.length) { history.pop(); window.removePlate(); render(); } });
clear.addEventListener("click", () => { while (history.length) { history.pop(); window.removePlate(); } render(); });
// The scene may finish loading after the user has already interacted.
window.getLoadedPlates = () => [...history];
render();

