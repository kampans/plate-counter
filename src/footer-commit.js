const footerCommit = document.querySelector(".footer-commit");

async function updateFooterCommit() {
  try {
    const response = await fetch("https://api.github.com/repos/kampans/plate-counter/commits/main", {
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) return;

    const { sha, commit } = await response.json();
    const subject = commit?.message?.split("\n", 1)[0].trim();
    if (!/^[a-f0-9]{40}$/.test(sha) || !subject) return;

    const shortHash = document.createElement("code");
    shortHash.textContent = sha.slice(0, 7);
    footerCommit.href = `https://github.com/kampans/plate-counter/commit/${sha}`;
    footerCommit.replaceChildren(shortHash, ` ${subject}`);
  } catch {
    // Keep the initial commit link when GitHub is unavailable.
  }
}

updateFooterCommit();
