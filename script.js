// plate counter logic

// plate definitions (kg) - calibrated colors
const PLATES_KG = [
	{ weight: 25, color: "#ff0000" }, // red
	{ weight: 20, color: "#0080ff" }, // blue
	{ weight: 15, color: "#ffd700" }, // yellow
	{ weight: 10, color: "#008000" }, // green
	{ weight: 5, color: "#ffffff" },  // white
	{ weight: 2.5, color: "#000000" }, // black
	{ weight: 1.25, color: "#808080" }, // grey
	{ weight: 0.5, color: "#ffffff" },
	{ weight: 0.25, color: "#808080" }
];

// plate definitions (lbs)
const PLATES_LBS = [
	{ weight: 45, color: "#ffd700" },
	{ weight: 35, color: "#0080ff" },
	{ weight: 25, color: "#ff0000" },
	{ weight: 10, color: "#ffffff" },
	{ weight: 5, color: "#008000" },
	{ weight: 2.5, color: "#800080" },
	{ weight: 1.25, color: "#ffffff" },
	{ weight: 0.5, color: "#ffffff" }
];

// app state
const state = {
	unit: "kg",
	barWeight: 20,
	targetWeight: 0
};

// dom elements
const targetInput = document.getElementById("target");
const unitSelect = document.getElementById("unit");
const calcBtn = document.getElementById("calc");
const results = document.getElementById("results");
const emptyState = document.getElementById("emptyState");
const totalDisplay = document.getElementById("totalDisplay");
const perSideDisplay = document.getElementById("perSide");
const plateList = document.getElementById("plateList");
const platesVisual = document.getElementById("platesVisual");
const toast = document.getElementById("toast");
const barBtns = document.querySelectorAll(".bar-btn");
const customBarWrap = document.querySelector(".custom-bar-wrap");
const customBarInput = document.getElementById("customBar");

// event listeners
calcBtn.addEventListener("click", calculate);
targetInput.addEventListener("keypress", (e) => {
	if (e.key === "Enter") calculate();
});

unitSelect.addEventListener("change", () => {
	state.unit = unitSelect.value;
	calculate();
});

barBtns.forEach((btn) => {
	btn.addEventListener("click", () => {
		barBtns.forEach((b) => b.classList.remove("active"));
		btn.classList.add("active");

		const val = btn.dataset.bar;
		if (val === "custom") {
			customBarWrap.style.display = "block";
			state.barWeight = parseFloat(customBarInput.value) || 20;
			customBarInput.focus();
		} else {
			customBarWrap.style.display = "none";
			state.barWeight = parseFloat(val);
		}
		calculate();
	});
});

customBarInput.addEventListener("input", () => {
	state.barWeight = parseFloat(customBarInput.value) || 20;
	calculate();
});

// main calculation
function calculate() {
	const raw = parseFloat(targetInput.value);
	if (isNaN(raw) || raw <= 0) {
		showToast("enter a valid weight");
		return;
	}

	state.targetWeight = raw;
	const bar = state.barWeight;
	const plates = state.unit === "kg" ? PLATES_KG : PLATES_LBS;

	// weight per side excluding the bar
	let remaining = (state.targetWeight - bar) / 2;

	if (remaining < 0) {
		showToast("target is lighter than the bar");
		results.style.display = "none";
		emptyState.style.display = "block";
		return;
	}

	const counts = {};
	let loadedPerSide = 0;

	// greedy: largest plates first
	for (const p of plates) {
		if (remaining <= 0) break;
		const count = Math.floor(remaining / p.weight);
		if (count > 0) {
			counts[p.weight] = count;
			loadedPerSide += count * p.weight;
			remaining -= count * p.weight;
		}
	}

	const totalPerSide = bar / 2 + loadedPerSide;
	const total = totalPerSide * 2;

	renderResults(counts, total, totalPerSide, loadedPerSide, remaining);
}

// render results to the dom
function renderResults(counts, total, totalPerSide, loadedPerSide, remaining) {
	emptyState.style.display = "none";
	results.style.display = "block";

	totalDisplay.textContent = total.toFixed(2) + " " + state.unit;
	perSideDisplay.textContent = "per side (" + totalPerSide.toFixed(2) + " " + state.unit + ")";

	plateList.innerHTML = "";

	const plates = state.unit === "kg" ? PLATES_KG : PLATES_LBS;
	let hasPlates = false;

	for (const p of plates) {
		const count = counts[p.weight] || 0;
		if (count > 0) {
			hasPlates = true;
			const row = document.createElement("div");
			row.className = "plate-row";

			const swatch = document.createElement("div");
			swatch.className = "plate-swatch";
			swatch.style.background = p.color;
			swatch.textContent = p.weight;

			const info = document.createElement("div");
			info.className = "plate-info";

			const weightDiv = document.createElement("div");
			weightDiv.className = "plate-weight";
			weightDiv.textContent = p.weight + " " + state.unit;

			const countDiv = document.createElement("div");
			countDiv.className = "plate-count";
			countDiv.innerHTML = '<span class="num">' + count + "</span> x per side";

			info.appendChild(weightDiv);
			info.appendChild(countDiv);

			row.appendChild(swatch);
			row.appendChild(info);
			plateList.appendChild(row);
		}
	}

	if (!hasPlates) {
		const row = document.createElement("div");
		row.className = "plate-row";
		row.innerHTML = '<div class="plate-info"><div class="plate-weight">bar only</div><div class="plate-count">no plates needed</div></div>';
		plateList.appendChild(row);
	}

	renderBarbellVisual(counts);
}

// render the visual barbell
function renderBarbellVisual(counts) {
	platesVisual.innerHTML = "";

	const plates = state.unit === "kg" ? PLATES_KG : PLATES_LBS;
	const sidePlates = [];

	for (const p of plates) {
		const count = counts[p.weight] || 0;
		for (let i = 0; i < count; i++) {
			sidePlates.push(p.weight);
		}
	}

	// sort largest first so they sit closest to the center
	sidePlates.sort((a, b) => b - a);

	// left side plates
	sidePlates.forEach((weight, i) => {
		const plate = document.createElement("div");
		plate.className = "plate-on-bar " + plateSizeClass(weight);
		plate.style.background = getPlateColor(weight);
		plate.style.left = (14 + i * 30) + "px";
		plate.textContent = weight;
		platesVisual.appendChild(plate);
	});

	// right side plates (mirrored)
	sidePlates.forEach((weight, i) => {
		const plate = document.createElement("div");
		plate.className = "plate-on-bar " + plateSizeClass(weight);
		plate.style.background = getPlateColor(weight);
		plate.style.right = (14 + i * 30) + "px";
		plate.textContent = weight;
		platesVisual.appendChild(plate);
	});
}

function plateSizeClass(weight) {
	if (weight >= 20) return "large";
	if (weight >= 10) return "medium";
	return "";
}

function getPlateColor(weight) {
	const plates = state.unit === "kg" ? PLATES_KG : PLATES_LBS;
	const p = plates.find((x) => x.weight === weight);
	return p ? p.color : "#888";
}

function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add("show");
	setTimeout(() => toast.classList.remove("show"), 2000);
}