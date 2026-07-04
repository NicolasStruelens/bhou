(function () {
  var saved = localStorage.getItem('racine_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();
