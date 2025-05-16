exports.loginForm = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/devis');
  }
  res.render('auth/login', { 
    title: 'Connexion',
    messages: req.flash() 
  });
};

exports.logout = (req, res) => {
  req.logout(() => {
    req.flash('success', 'Vous etes deconnecte');
    res.redirect('/login');
  });
};