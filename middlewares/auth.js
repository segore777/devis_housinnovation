module.exports = {
    ensureAuthenticated: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error', 'Veuillez vous connecter');
        res.redirect('/login');
    }
};