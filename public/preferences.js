(() => {
  document.documentElement.dataset.js = "true";
  function apply(value) {
    document.documentElement.dataset.theme = value;
  }
  let current = document.documentElement.dataset.theme;
  try {
    current ||= localStorage.getItem("taqyeem-appearance");
  } catch {}
  apply(
    current === "dark" || current === "light"
      ? current
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
  );
  document.addEventListener("click", (event) => {
    let button = event.target.closest?.("[data-appearance]");
    if (!button) {
      return;
    }
    event.preventDefault();
    let value = button.dataset.appearance;
    apply(value);
    document.cookie = `taqyeem_appearance=${value}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === "https:" ? "; Secure" : ""}`;
    try {
      localStorage.setItem("taqyeem-appearance", value);
    } catch {}
    for (let el of document.querySelectorAll("[data-appearance]")) {
      el.setAttribute("aria-pressed", String(el.dataset.appearance === value));
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    for (let el of document.querySelectorAll("[data-appearance]")) {
      el.setAttribute(
        "aria-pressed",
        String(
          el.dataset.appearance === document.documentElement.dataset.theme,
        ),
      );
    }
  });
})();
