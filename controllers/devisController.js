const Devis = require('../models/Devis');
const User = require('../models/User');
const { generateDevisPDF } = require('../config/pdfGenerator');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Configuration de l'email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.nouveauDevis = (req, res) => {
  res.render('devis/form');
};

exports.creerDevis = async (req, res) => {
  try {
    const createur = await User.findById(req.user._id);
    
    // Calculs du devis
    const surface = parseFloat(req.body.surface);
    const hauteur = parseFloat(req.body.hauteur);
    
    const poidsAcier = surface * hauteur * 0.15;
    const volumeBeton = surface * 0.3;
    const surfaceToiture = surface * 1.2;
    
    const totalAcier = poidsAcier * 350;
    const totalBeton = volumeBeton * 8000;
    const totalToiture = surfaceToiture * 1200;
    const totalMainOeuvre = surface * 10 * 1500;
    
    const totalHT = totalAcier + totalBeton + totalToiture + totalMainOeuvre;
    const tva = totalHT * 0.15;
    const totalTTC = totalHT + tva;
    
    // Numéro de devis
    const devisNumber = `HI-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    
    // Création du devis
    const nouveauDevis = new Devis({
      numero: devisNumber,
      createur: createur._id,
      client: {
        nom: req.body.clientNom,
        email: req.body.clientEmail,
        telephone: req.body.clientTelephone,
        adresse: req.body.clientAdresse
      },
      details: {
        surface,
        hauteur,
        typeToiture: req.body.typeToiture,
        options: req.body.options || []
      },
      calculs: {
        poidsAcier,
        volumeBeton,
        surfaceToiture
      },
      total: {
        acier: totalAcier,
        beton: totalBeton,
        toiture: totalToiture,
        mainOeuvre: totalMainOeuvre
      },
      totalHT,
      tva,
      totalTTC
    });
    
    // Sauvegarde dans MongoDB
    const devisSauvegarde = await nouveauDevis.save();
    
    // Génération du PDF
    const pdfPath = path.join(__dirname, '../../devis-sauvegardes', `devis-${devisNumber}.pdf`);
    await generateDevisPDF({
      ...devisSauvegarde.toObject(),
      createur: {
        nom: `${createur.prenom} ${createur.nom}`,
        email: createur.email,
        telephone: createur.telephone
      }
    }, pdfPath);
    
    // Envoi par email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: [req.body.clientEmail, createur.email, 'info@housinnovation.com'],
      subject: `Votre devis HousInnovation ${devisNumber}`,
      html: `
        <h2 style="color: #0E8484;">Votre devis HousInnovation</h2>
        <p>Bonjour ${req.body.clientNom},</p>
        <p>Veuillez trouver ci-joint votre devis pour une maison en structure acier préparé par ${createur.prenom} ${createur.nom}.</p>
        <p style="font-size: 1.2em;"><strong>Montant total: ${totalTTC.toLocaleString('fr-FR')} Rs</strong></p>
        <p>Ce devis est valable 30 jours.</p>
        <p>Pour toute question, contactez-nous au +230 5 727 2727.</p>
        <p>Cordialement,<br>L'équipe HousInnovation</p>
      `,
      attachments: [{
        filename: `devis-${devisNumber}.pdf`,
        path: pdfPath
      }]
    });
    
    // Redirection vers le devis
    req.flash('success', 'Devis créé avec succès et envoyé au client');
    res.redirect(`/devis/${devisSauvegarde._id}`);
    
  } catch (err) {
    console.error('Erreur création devis:', err);
    req.flash('error', 'Une erreur est survenue lors de la création du devis');
    res.redirect('/devis/nouveau');
  }
};

exports.voirDevis = async (req, res) => {
  try {
    const devis = await Devis.findById(req.params.id).populate('createur');
    if (!devis) {
      req.flash('error', 'Devis non trouvé');
      return res.redirect('/devis');
    }
    
    res.render('devis/view', { devis });
  } catch (err) {
    console.error('Erreur récupération devis:', err);
    req.flash('error', 'Une erreur est survenue');
    res.redirect('/devis');
  }
};

exports.listeDevis = async (req, res) => {
  try {
    const devisList = await Devis.find({ createur: req.user._id })
                               .sort({ date: -1 });
    res.render('devis/list', { devis: devisList });
  } catch (err) {
    console.error('Erreur récupération liste devis:', err);
    req.flash('error', 'Une erreur est survenue');
    res.redirect('/');
  }
};