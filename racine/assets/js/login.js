document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var pwd = document.getElementById('password').value;
  var errEl = document.getElementById('loginError');
  errEl.textContent = '';
  RA.login(pwd).then(function () {
    location.href = 'app.html';
  }).catch(function (err) {
    errEl.textContent = err.message || 'Mot de passe incorrect.';
  });
});
