// Applies the saved day/night theme before the app renders, so pages never flash the wrong colours.
(function () {
  try {
    var saved = localStorage.getItem('voffice_theme');
    var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    /* storage blocked: stay on the day theme */
  }
})();
