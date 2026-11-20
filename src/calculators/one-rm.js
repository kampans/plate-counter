const oneRmForm = document.getElementById("one-rm-form");
const oneRmResult = document.getElementById("one-rm-result");

const oneRmFormulas = {
  epley: (weight, reps) => weight * (1 + reps / 30),
  brzycki: (weight, reps) => weight * 36 / (37 - reps)
};

function renderOneRm() {
  const { weight, reps, formula } = oneRmForm.elements;
  const load = weight.valueAsNumber;
  if (!oneRmForm.checkValidity() || load <= 0) {
    oneRmResult.textContent = "";
    return;
  }

  const count = reps.valueAsNumber;
  const estimate = count === 1 ? load : oneRmFormulas[formula.value](load, count);
  oneRmResult.textContent = `Estimated 1RM: ${formatWeight(estimate)} kg`;
}

oneRmForm.addEventListener("input", renderOneRm);
oneRmForm.addEventListener("submit", event => event.preventDefault());
