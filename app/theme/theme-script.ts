export const THEME_STORAGE_KEY: string = "theme";

/**
 * Se ejecuta antes de la primera pintura para aplicar el tema guardado
 * (o el del sistema) sin parpadeo, ya que React aún no ha hidratado nada.
 */
export const THEME_INIT_SCRIPT: string = `
(function () {
  try {
    var theme = localStorage.getItem("${THEME_STORAGE_KEY}");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = theme === "dark" || (theme !== "light" && prefersDark);
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
