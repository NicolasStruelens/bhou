RA.me().then(function () {
  location.replace('app.html');
}).catch(function () {
  location.replace('login.html');
});
