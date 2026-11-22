{
  const reminder = document.getElementById("share-reminder");
  const shareButton = document.getElementById("share-site");
  const linkLabel = document.getElementById("share-site-link");
  const status = document.getElementById("share-site-status");
  const storageKey = "plate-counter-share-reminder-shown";
  const cooldown = 3 * 24 * 60 * 60 * 1000;
  const url = new URL("./", window.location.href).href;

  function showReminderWhenDue() {
    if (document.hidden || document.querySelector("dialog[open]") ||
        document.activeElement?.matches("input, select, textarea")) return;

    try {
      const lastShown = localStorage.getItem(storageKey);
      const now = Date.now();
      if (lastShown !== null && now - Number(lastShown) < cooldown) return;
      localStorage.setItem(storageKey, String(now));
    } catch {
      // Without storage, the cooldown cannot be enforced across visits.
      return;
    }
    reminder.showModal();
  }

  setTimeout(showReminderWhenDue, 20000);

  shareButton.addEventListener("click", async () => {
    shareButton.disabled = true;
    status.textContent = "";
    try {
      // Start both actions on the same tap, before the share sheet consumes activation.
      const copy = navigator.clipboard?.writeText(url).then(() => true, () => false);
      const share = navigator.share?.({ title: "Plate counter", url }).catch(() => {});
      if (await copy) {
        linkLabel.hidden = true;
        status.textContent = "Link copied to clipboard.";
      } else {
        linkLabel.querySelector("input").value = url;
        linkLabel.hidden = false;
      }
      await share;
    } finally {
      shareButton.disabled = false;
    }
  });
}
