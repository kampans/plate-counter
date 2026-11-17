// plate counter logic

// eleiko plate colors (kg) - official color coding
const PLATES_KG = [
	{ weight: 25, color: "#cc0000", textColor: "#fff" }, // red
	{ weight: 20, color: "#1a52cc", textColor: "#fff" }, // blue
	{ weight: 15, color: "#e8c800", textColor: "#000" }, // yellow
	{ weight: 10, color: "#1a7a1a", textColor: "#fff" }, // green
	{ weight: 5,  color: "#f0f0f0", textColor: "#000" }, // white
	{ weight: 2.5, color: "#111111", textColor: "#fff" }, // black
	{ weight: 1.25, color: "#888888", textColor: "#fff" }, // grey
	{ weight: 0.5,  color: "#f0f0f0", textColor: "#000" },
	{ weight: 0.25, color: "#888888", textColor: "#fff" }
];

// plate definitions (lbs)
const PLATES_LBS = [
	{ weight: 45,   color: "#e8c800", textColor: "#000" },
	{ weight: 35,   color: "#1a52cc", textColor: "#fff" },
	{ weight: 25,   color: "#cc0000", textColor: "#fff" },
	{ weight: 10,   color: "#f0f0f0", textColor: "#000" },
	{ weight: 5,    color: "#1a7a1a", textColor: "#fff" },
	{ weight: 2.5,  color: "#800080", textColor: "#fff" },
	{ weight: 1.25, color: "#f0f0f0", textColor: "#000" },
	{ weight: 0.5,  color: "#f0f0f0", textColor: "#000" }
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
			swatch.style.color = p.textColor || "#000";
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

}

function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add("show");
	setTimeout(() => toast.classList.remove("show"), 2000);
}