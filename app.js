require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs'); // Ajouté car utilisé plus bas
const flash = require('connect-flash'); // Déplacé en haut avec les autres requires

// Configuration de la base de données
require('./config/db');
require('./config/passport');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.DB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 jour
})); // Accolade fermante ajoutée ici

// Flash messages
app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Variables globales
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Configuration des vues
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes
app.use('/', require('./routes/devisRoutes'));

// Dossier de sauvegarde
const devisDir = path.join(__dirname, 'devis-sauvegardes');
if (!fs.existsSync(devisDir)) {
  fs.mkdirSync(devisDir);
}

// Serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});