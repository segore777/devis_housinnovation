require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const init = async () => {
  await require('./config/db')();
  
  const adminEmails = process.env.ADMIN_EMAILS.split(',');
  
  // Creation de Quentin ROGES
  const quentin = new User({
    prenom: 'Quentin',
    nom: 'ROGES',
    email: 'q.roges@housinnovation.com',
    telephone: '+230 5 857 8401',
    password: await bcrypt.hash('motdepasse123', 10), // A changer
    role: 'admin'
  });
  
  // Creation de Lindsay DELIA
  const lindsay = new User({
    prenom: 'Lindsay',
    nom: 'DELIA',
    email: 'l.delia@housinnovation.com',
    telephone: '+230 5 919 3689',
    password: await bcrypt.hash('motdepasse123', 10), // A changer
    role: 'admin'
  });
  
  await quentin.save();
  await lindsay.save();
  
  console.log('Utilisateurs admin crees avec succes');
  process.exit();
};

init().catch(err => {
  console.error('Erreur initialisation:', err);
  process.exit(1);
});