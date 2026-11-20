const installButton = document.getElementById("install-app");
const installHelp = document.getElementById("install-help");
let pendingInstallPrompt;

installButton.hidden = window.matchMedia("(display-mode: standalone)").matches;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  pendingInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  pendingInstallPrompt = undefined;
  installButton.hidden = true;
});

installButton.addEventListener("click", async () => {
  if (!pendingInstallPrompt) {
    installHelp.showModal();
    return;
  }

  const prompt = pendingInstallPrompt;
  pendingInstallPrompt = undefined;
  installButton.disabled = true;
  try {
    const { outcome } = await prompt.prompt();
    if (outcome === "accepted") installButton.hidden = true;
  } catch {
    installHelp.showModal();
  } finally {
    installButton.disabled = false;
  }
});
