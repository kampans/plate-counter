const scoreForm = document.getElementById("score-form");
const scoreResult = document.getElementById("score-result");
const liftResultLabel = document.getElementById("lift-result-label");

function renderScores() {
  const { bodyweight, liftResult, division, equipment, eventType } = scoreForm.elements;
  const isFullMeet = eventType.value === "full";
  liftResultLabel.textContent = isFullMeet ? "Total (kg)" : "Bench press (kg)";
  const weight = bodyweight.valueAsNumber;
  if (!scoreForm.checkValidity() || weight <= 0) {
    scoreResult.textContent = "";
    return;
  }

  const result = liftResult.valueAsNumber;
  const gl = calculateGlPoints(weight, result, division.value, eventType.value, equipment.value);
  const glText = gl === null
    ? `IPF GLP requires a bodyweight of at least ${glDivisions[division.value].minBodyweight} kg.`
    : `${gl.toFixed(3)} IPF GL`;
  const dotsText = isFullMeet
    ? `${calculateDots(weight, result, division.value).toFixed(2)} DOTS`
    : "DOTS available for full powerlifting totals.";

  scoreResult.replaceChildren(dotsText, document.createElement("br"), glText);
}

scoreForm.addEventListener("input", renderScores);
scoreForm.addEventListener("submit", event => event.preventDefault());
