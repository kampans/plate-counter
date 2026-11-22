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
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: "Plate counter", url });
          reminder.close();
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      shareButton.textContent = "Link copied";
      status.textContent = "Site link copied to clipboard.";
    } catch {
      linkLabel.hidden = false;
      const link = linkLabel.querySelector("input");
      link.value = url;
      link.focus();
      link.select();
    } finally {
      shareButton.disabled = false;
    }
  });
}
