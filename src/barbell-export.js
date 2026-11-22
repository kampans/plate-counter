function createBarbellPng(barbell, caption) {
  const shaft = barbell.querySelector(".barbell-shaft");
  const shoulder = barbell.querySelector(".barbell-shoulder");
  const sleeve = barbell.querySelector(".barbell-sleeve");
  const sleeveBox = sleeve.getBoundingClientRect();
  const sleeveStyle = getComputedStyle(sleeve, "::before");
  const sleeveHeight = parseFloat(sleeveStyle.height);
  const sleeveTop = sleeveBox.top + (sleeveBox.height - sleeveHeight) / 2;
  const parts = [shaft, shoulder, ...barbell.querySelectorAll(".plate-profile")].map(element => ({
    element,
    box: element.getBoundingClientRect(),
    style: getComputedStyle(element)
  }));

  const left = parts[0].box.left;
  const right = Math.max(sleeveBox.right, ...parts.map(({ box }) => box.right));
  const top = Math.min(sleeveTop, ...parts.map(({ element, box }) => {
    if (!element.classList.contains("collar-profile")) return box.top;
    return box.top - parseFloat(getComputedStyle(element, "::before").height);
  }));
  const bottom = Math.max(sleeveTop + sleeveHeight, ...parts.map(({ box }) => box.bottom));
  const padding = 24;
  const captionInset = 12;
  const captionSize = 24;
  const canvas = document.createElement("canvas");
  const width = Math.max(right - left, caption.length * captionSize + captionInset * 2) + padding * 2;
  const height = bottom - top + padding * 3 + captionSize;
  const scale = Math.min(3, 4096 / Math.max(width, height));
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.translate((width - (right - left)) / 2 - left, padding - top);

  function drawLabel(label) {
    const box = label.getBoundingClientRect();
    const style = getComputedStyle(label);
    const fontSize = parseFloat(style.fontSize);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = box.left + box.width / 2;
    if (label.classList.contains("plate-number")) {
      [...label.textContent].forEach((digit, index) => {
        ctx.fillText(digit, x, box.top + (index + .5) * fontSize);
      });
    } else if (label.classList.contains("plate-weight")) {
      ctx.save();
      ctx.translate(x, box.top + box.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label.textContent, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(label.textContent, x, box.top + box.height / 2);
    }
  }

  ctx.fillStyle = sleeveStyle.backgroundColor;
  ctx.fillRect(sleeveBox.left, sleeveTop, sleeveBox.width, sleeveHeight);
  for (const { element, box, style } of parts) {
    const radius = parseFloat(style.borderTopLeftRadius);
    const border = parseFloat(style.borderTopWidth);
    ctx.beginPath();
    ctx.roundRect(box.left, box.top, box.width, box.height, radius);
    ctx.fillStyle = border ? style.borderTopColor : style.backgroundColor;
    ctx.fill();
    if (border) {
      ctx.beginPath();
      ctx.roundRect(box.left + border, box.top + border, box.width - 2 * border,
        box.height - 2 * border, Math.max(0, radius - border));
      ctx.fillStyle = style.backgroundColor;
      ctx.fill();
    }
    if (element.classList.contains("collar-profile")) {
      const knob = getComputedStyle(element, "::before");
      ctx.fillStyle = knob.backgroundColor;
      ctx.fillRect(box.left + parseFloat(knob.left), box.top - parseFloat(knob.height),
        parseFloat(knob.width), parseFloat(knob.height));
      ctx.fillRect(box.right - 3, box.top, 3, box.height);
    }
    for (const label of element.children) drawLabel(label);
  }

  const totalStyle = getComputedStyle(document.getElementById("total"));
  ctx.font = `400 ${captionSize}px ${totalStyle.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  const captionY = bottom + padding + captionSize / 2;
  ctx.fillText(caption, left + captionInset, captionY);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the barbell PNG."));
    }, "image/png");
  });
}
