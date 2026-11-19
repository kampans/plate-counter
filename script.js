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
  const plates = history.filter(item => item !== config.collar);
  const collars = history.filter(item => item === config.collar);
  plateStack.replaceChildren(...[...plates, ...collars].map(plate => {
    const profile = document.createElement("span");
    profile.className = plate === config.collar ? "plate-profile collar-profile" : "plate-profile";
    if (plate.color) profile.style.setProperty("--plate-color", plate.color);
    profile.style.setProperty("--diameter", plate.diameter);
    profile.style.setProperty("--thickness", plate.thickness);
    return profile;
  }));
  choices.forEach(({ item, countLabel }) => {
    const count = history.filter(loaded => loaded === item).length;
    countLabel.textContent = count > 0 ? `${count} per side` : "";
  });
  undo.disabled = clear.disabled = history.length === 0;
}
document.getElementById("bar-weight").textContent = `${formatWeight(config.barWeight)} kg`;
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
  button.addEventListener("click", () => { history.push(item); render(); });

  const choice = document.createElement("div");
  choice.className = "plate-choice";
  const countLabel = document.createElement("span");
  countLabel.className = "plate-count";
  choice.append(button, countLabel);
  document.getElementById("plate-buttons").appendChild(choice);
  return { item, countLabel };
});
undo.addEventListener("click", () => { history.pop(); render(); });
clear.addEventListener("click", () => { history.length = 0; render(); });
render();

