// DOTS bounds match OpenPowerlifting's reference implementation.
const dotsDivisions = {
  men: { maxBodyweight: 210, coefficients: [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076] },
  women: { maxBodyweight: 150, coefficients: [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288] }
};

const glDivisions = {
  men: {
    minBodyweight: 40,
    full: { classic: [1199.72839, 1025.18162, 0.00921], equipped: [1236.25115, 1449.21864, 0.01644] },
    bench: { classic: [320.98041, 281.40258, 0.01008], equipped: [381.22073, 733.79378, 0.02398] }
  },
  women: {
    minBodyweight: 35,
    full: { classic: [610.32796, 1045.59282, 0.03048], equipped: [758.63878, 949.31382, 0.02435] },
    bench: { classic: [142.40398, 442.52671, 0.04724], equipped: [221.82209, 357.00377, 0.02937] }
  }
};

function calculateDots(bodyweight, total, division) {
  const { maxBodyweight, coefficients } = dotsDivisions[division];
  const weight = Math.max(40, Math.min(maxBodyweight, bodyweight));
  const denominator = coefficients.reduce((value, coefficient) => value * weight + coefficient, 0);
  return total * (500 / denominator);
}

function calculateGlPoints(bodyweight, result, division, event, equipment) {
  const settings = glDivisions[division];
  if (bodyweight < settings.minBodyweight) return null;

  const coefficient = Number(glCoefficient(bodyweight, division, event, equipment).toFixed(6));
  return Number((result * coefficient).toFixed(6));
}

function glCoefficient(bodyweight, division, event, equipment) {
  const [a, b, c] = glDivisions[division][event][equipment];
  return 100 / (a - b * Math.exp(-c * bodyweight));
}
