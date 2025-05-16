const express = require('express');
const router = express.Router();
const passport = require('passport');
const { ensureAuthenticated } = require('../middlewares/auth');

// Importez explicitement les contrôleurs
const devisController = require('../controllers/devisController');
const authController = require('../controllers/authController');

// Route d'accueil
router.get('/', (req, res) => {
  res.render('index', { title: 'Accueil' });
});

// Routes d'authentification
router.get('/login', authController.loginForm);
router.post('/login', 
  passport.authenticate('local', {
    successRedirect: '/devis',
    failureRedirect: '/login',
    failureFlash: true
  })
);
router.get('/logout', authController.logout);

// Routes protégées
router.get('/devis', ensureAuthenticated, devisController.listeDevis);
router.get('/devis/nouveau', ensureAuthenticated, devisController.nouveauDevis);
router.post('/devis', ensureAuthenticated, devisController.creerDevis);
router.get('/devis/:id', ensureAuthenticated, devisController.voirDevis);

module.exports = router;