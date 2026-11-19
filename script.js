const config = window.PLATE_COUNTER_CONFIG;
const history = [];
const totalDisplay = document.getElementById("total");
const perSideDisplay = document.getElementById("per-side");
const plateStack = document.getElementById("plate-stack");
const undo = document.getElementById("undo");
const clear = document.getElementById("clear");
function formatWeight(weight) { return Number(weight.toFixed(2)).toString(); }

function render() {
  const perSide = history.reduce((sum, plate) => sum + plate.weight, 0);
  const total = formatWeight(config.barWeight + perSide * 2);
  totalDisplay.textContent = total;
  document.getElementById("total-announcement").textContent = `Total weight: ${total} kilograms`;
  perSideDisplay.textContent = `${formatWeight(perSide)} kg`;
  plateStack.replaceChildren(...history.map(plate => {
    const profile = document.createElement("span");
    profile.className = "plate-profile";
    profile.style.setProperty("--plate-color", plate.color);
    profile.style.setProperty("--diameter", plate.diameter);
    profile.style.setProperty("--thickness", plate.thickness);
    return profile;
  }));
  document.querySelectorAll(".plate-choice").forEach((choice) => { const count = history.filter(plate => plate.weight === Number(choice.dataset.weight)).length; const el = choice.querySelector(".plate-count"); el.textContent = count > 0 ? `${count} per side` : ""; });
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
  button.addEventListener("click", () => { history.push(plate); render(); });
  const choice = document.createElement("div"); choice.className = "plate-choice"; choice.dataset.weight = plate.weight; const count = document.createElement("span"); count.className = "plate-count"; choice.append(button, count); document.getElementById("plate-buttons").appendChild(choice);
});
undo.addEventListener("click", () => { history.pop(); render(); });
clear.addEventListener("click", () => { history.length = 0; render(); });
render();

