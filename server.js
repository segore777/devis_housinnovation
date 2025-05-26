require('dotenv').config(); // Charge le fichier .env

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const app = express();
const port = process.env.PORT || 3000;

// Configuration de bodyParser, express-session et accès aux fichiers statiques
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secret-key-housinnovation',
  resave: false,
  saveUninitialized: true
}));

// Définition des commerciaux
const salesReps = {
  quentin: {
    name: "Quentin ROGES",
    email: "q.roges@housinnovation.com",
    phone: "+230 5 857 8401"
  },
  blandine: {
    name: "Blandine Ni",
    email: "b.ni@housinnovation.com",
    phone: "+230 5 502 7337"
  },
  lindsay: {
    name: "Lindsay DELIA",
    email: "l.delia@housinnovation.com",
    phone: "+230 5 919 3689"
  }
};

// Configuration SMTP pour chaque commercial via les variables d'environnement
const smtpCredentials = {
  quentin: {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.QUENTIN_SMTP_USER,
      pass: process.env.QUENTIN_SMTP_PASS
    }
  },
  blandine: {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.BLANDINE_SMTP_USER,
      pass: process.env.BLANDINE_SMTP_PASS
    }
  },
  lindsay: {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.LINDSAY_SMTP_USER,
      pass: process.env.LINDSAY_SMTP_PASS
    }
  }
};

// Fonction de mise à jour (ou création) du fichier Excel clients
function updateClientExcel(clientData) {
  const filePath = path.join(__dirname, 'clients.xlsx');
  let workbook;
  if (fs.existsSync(filePath)) {
    workbook = XLSX.readFile(filePath);
  } else {
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), 'Clients');
  }
  let worksheet = workbook.Sheets['Clients'];
  let data = XLSX.utils.sheet_to_json(worksheet);
  data.push(clientData);
  const newWorksheet = XLSX.utils.json_to_sheet(data);
  workbook.Sheets['Clients'] = newWorksheet;
  XLSX.writeFile(workbook, filePath);
}

// Fonction de génération du devis au format PDF avec PDFKit
function drawRow(doc, x, y, width, height, label, value, options = {}) {
  // Dessiner le contour du rectangle
  doc.rect(x, y, width, height).stroke();
  // Afficher le texte de la première colonne
  doc.text(label, x + 5, y + 5, { width: width / 2 - 10 });
  // Si l'option bold est spécifiée, on utilise une police en gras pour la valeur
  if (options.bold) {
    doc.font('Helvetica-Bold');
  }
  // Afficher le texte de la deuxième colonne
  doc.text(value, x + width / 2 + 5, y + 5, { width: width / 2 - 10 });
  if (options.bold) {
    doc.font('Helvetica');
  }
}

function formatPriceUK(price) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'MUR',
    minimumFractionDigits: 0, // pas de centimes
    maximumFractionDigits: 0
  }).format(price);
}

function generateQuotePDF(quote, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    
    const pageWidth = doc.page.width;

    // --- En-tête ---
    // On place le logo en haut à gauche
    doc.image('public/logo.png', 20, 20, { width: 100 });
    
    // Textes d'en-tête positionnés à droite du logo
    const headerX = 130; // après le logo (20 + 100 + 10)
    const headerY = 20;
    doc.fillColor('#0E8484')
       .fontSize(18)
       .text('Housinnovation', headerX, headerY + 10, { align: 'left' });
    doc.fillColor('#333')
       .fontSize(10)
       .text(`Devis Express - ${quote.date}`, headerX, headerY + 35, { align: 'left' });
    doc.text(`Numéro du devis : ${quote.quoteNumber}`, headerX, headerY + 50, { align: 'left' });
    
    // Ligne horizontale sous l'en-tête
    let currentY = headerY + 100;
    doc.moveTo(20, currentY)
       .lineTo(pageWidth - 20, currentY)
       .lineWidth(2)
       .strokeColor('#0E8484')
       .stroke();
    
    currentY += 10;

    // --- Section "Informations Commercial" ---
    // Fond de section
    doc.rect(20, currentY, pageWidth - 40, 18)
       .fill('#0E8484');
    doc.fillColor('white')
       .fontSize(12)
       .text('Informations Commercial', 25, currentY + 2);
    doc.fillColor('#333')
       .fontSize(10);
    currentY += 25;
    doc.text(`Nom : ${quote.salesRep.name}`, 25, currentY);
    currentY += 12;
    doc.text(`Email : ${quote.salesRep.email}`, 25, currentY);
    currentY += 12;
    doc.text(`Téléphone : ${quote.salesRep.phone}`, 25, currentY);
    currentY += 18;

    // --- Section "Informations Client" ---
    doc.rect(20, currentY, pageWidth - 40, 18)
       .fill('#0E8484');
    doc.fillColor('white')
       .fontSize(12)
       .text('Informations Client', 25, currentY + 2);
    doc.fillColor('#333')
       .fontSize(10);
    currentY += 25;
    doc.text(`Nom : ${quote.client.name}`, 25, currentY);
    currentY += 12;
    doc.text(`Email : ${quote.client.email}`, 25, currentY);
    currentY += 12;
    doc.text(`Téléphone : ${quote.client.phone}`, 25, currentY);
    currentY += 12;
    doc.text(`Adresse : ${quote.client.address}`, 25, currentY);
    currentY += 18;

    // --- Section "Détails du Projet" ---
    doc.rect(20, currentY, pageWidth - 40, 18)
       .fill('#0E8484');
    doc.fillColor('white')
       .fontSize(12)
       .text('Détails du Projet', 25, currentY + 2);
    doc.fillColor('#333')
       .fontSize(10);
    currentY += 25;

    // Paramètres du tableau
    const tableX = 20;
    const tableWidth = pageWidth - 40;
    const rowHeight = 15;

    const projectRows = [
      { label: "Type de Maison", value: quote.project.type },
      { label: "Surface (m²)", value: quote.project.surface },
      { label: "Hauteur sous plafond (m)", value: quote.project.ceilingHeight },
      { label: "Fondation en béton armé", value: quote.project.foundation === "oui" ? "Oui" : "Non" },
      { label: "Revêtement du toit", value: quote.project.roofCovering.charAt(0).toUpperCase() + quote.project.roofCovering.slice(1) },
      { label: "Revêtement extérieur", value: quote.project.exteriorFinish.charAt(0).toUpperCase() + quote.project.exteriorFinish.slice(1) },
      { label: "Isolation complète", value: quote.project.isolation === "oui" ? "Oui" : "Non" },
      { label: "Revêtement intérieur", value: quote.project.interiorFinish.charAt(0).toUpperCase() + quote.project.interiorFinish.slice(1) },
      { label: "Electricité et plomberie", value: quote.project.electricity === "oui" ? "Oui" : "Non" },
      { label: "Aluminium", value: quote.project.aluminium === "oui" ? "Oui" : "Non" },
      { label: "Céramique", value: quote.project.ceramique === "oui" ? "Oui" : "Non" }
    ];

    projectRows.forEach(row => {
      drawRow(doc, tableX, currentY, tableWidth, rowHeight, row.label, row.value);
      currentY += rowHeight;
    });

    currentY += 10;

    // --- Section "Récapitulatif des Coûts" ---
    doc.rect(20, currentY, pageWidth - 40, 18)
       .fill('#0E8484');
    doc.fillColor('white')
       .fontSize(12)
       .text('Récapitulatif des Coûts', 25, currentY + 2);
    doc.fillColor('#333')
       .fontSize(10);
    currentY += 25;

    const costRows = [
      { label: "Coût Fondation", value: quote.project.foundationCost },
      { label: "Coût de la structure (acier)", value: quote.project.structureCost },
      { label: "Coût Revêtement du toit", value: quote.project.roofCoveringCost },
      { label: "Coût finition extérieure", value: quote.project.exteriorCost },
      { label: "Coût Isolation complète", value: quote.project.isolationCost },
      { label: "Coût finition intérieure", value: quote.project.interiorCost },
      { label: "Coût Electricité et plomberie", value: quote.project.electricityCost },
      { label: "Coût Aluminium", value: quote.project.aluminiumCost },
      { label: "Coût Céramique", value: quote.project.ceramiqueCost }
    ];

    costRows.forEach(row => {
      drawRow(doc, tableX, currentY, tableWidth, rowHeight, row.label, formatPriceUK(row.value));
      currentY += rowHeight;
    });

    drawRow(doc, tableX, currentY, tableWidth, rowHeight, "Total", formatPriceUK(quote.project.basePrice), { bold: true });
    currentY += rowHeight;
    drawRow(doc, tableX, currentY, tableWidth, rowHeight, "Prix au m²", formatPriceUK(quote.project.pricePerSqm), { bold: true });
    currentY += rowHeight + 10;

    // --- Pied de page ---
// Ligne horizontale
doc.moveTo(20, currentY)
   .lineTo(pageWidth - 20, currentY)
   .strokeColor('#ccc')
   .stroke();

// Descendre le texte du pied de page pour le positionner sous la ligne grise
currentY += 20; // décalage vertical supplémentaire

// Afficher le texte centré sur la largeur disponible
doc.fontSize(9)
   .text("Votre maison finie en 90jours !", 20, currentY, {
     width: pageWidth - 40,
     align: 'center'
   });
currentY += 12;
doc.text("Le présent devis est établi à titre indicatif et est susceptible d'être révisé après validation des plans par notre ingénieur.", 20, currentY, {
     width: pageWidth - 40,
     align: 'center'
   });
    doc.end();

    stream.on('finish', () => {
      console.log("PDF généré avec succès !");
      resolve(outputPath);
    });
    stream.on('error', (err) => {
      console.error("Erreur lors de l'écriture du PDF :", err);
      reject(err);
    });
  });
}

module.exports = { generateQuotePDF };

// ----- Routes ----- //

// Page d'accueil : sélection du commercial (HTML inline)
app.get('/', (req, res) => {
  let html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Housinnovation - Sélection Commercial</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
        .button { padding: 10px 20px; margin: 5px; background-color: #0E8484; color: #fff; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>Sélectionnez le commercial</h1>
      <form method="post" action="/select">
  `;
  for (let key in salesReps) {
    html += `<button class="button" type="submit" name="rep" value="${key}">${salesReps[key].name}</button>`;
  }
  html += `
      </form>
    </body>
    </html>
  `;
  res.send(html);
});

// Stockage du commercial sélectionné en session
app.post('/select', (req, res) => {
  const rep = req.body.rep;
  if (!salesReps[rep]) {
    return res.send("Commercial non valide.");
  }
  req.session.salesRep = salesReps[rep];
  req.session.repKey = rep;
  res.redirect('/quote');
});

// Formulaire de création du devis (HTML inline)
app.get('/quote', (req, res) => {
  if (!req.session.salesRep) return res.redirect('/');
  
  const salesRep = req.session.salesRep;
  let html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Création du Devis - Housinnovation</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .container { max-width: 600px; margin: auto; }
        label { display: block; margin-top: 10px; }
        input, select { width: 100%; padding: 8px; margin-top: 5px; }
        button { padding: 10px 20px; background-color: #0E8484; color: #fff; border: none; cursor: pointer; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Création du Devis</h1>
        <p>Commercial assigné : <strong>${salesRep.name}</strong></p>
        <form method="post" action="/quote">
          <h2>Informations Client</h2>
          <label>Nom du Client</label>
          <input type="text" name="clientName" required>
          
          <label>Email du Client</label>
          <input type="email" name="clientEmail" required>
          
          <label>Téléphone du Client</label>
          <input type="text" name="clientPhone" required>
          
          <label>Adresse du Client (optionnel)</label>
          <input type="text" name="clientAddress">
          
          <h2>Détails du Projet</h2>
          <label>Type de Maison</label>
          <select name="projectType">
            <option value="Maison plein-pied">Maison plein-pied</option>
            <option value="Maison à étages">Maison à étages</option>
          </select>
          
          <label>Fondation en béton armé</label>
          <select name="foundation" required>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
          
          <label>Surface du bâtiment (m²)</label>
          <input type="number" name="surface" step="0.1" required>
          
          <label>Hauteur sous plafond (m)</label>
          <input type="number" name="ceilingHeight" step="0.1" required>
          
          <label>Revêtement du toit</label>
          <select name="roofCovering" required>
            <option value="ondulées">MGO + Waterproofing + Tôles ondulées</option>
            <option value="wallofChina">MGO + Waterproofing + Tôles "Wall of China" isolées</option>
            <option value="waterproof">MGO + Waterproofing (gris)</option>
          </select>
          
          <label>Revêtement extérieur</label>
          <select name="exteriorFinish" required>
            <option value="crépissage">MGO + Crépissage</option>
            <option value="finishBoard">MGO + Finish Board au choix</option>
            <option value="mgo">MGO seulement</option>
          </select>
          
          <label>Isolation complète</label>
          <select name="isolation" required>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
          
          <label>Revêtement intérieur</label>
          <select name="interiorFinish" required>
            <option value="gypsumBoard">Gypsum Board + peinture</option>
            <option value="nanoBoard">Nano Board</option>
            <option value="aucun">Aucun</option>
          </select>
          
          <label>Electricité et plomberie</label>
          <select name="electricity" required>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
          
          <label>Aluminium</label>
          <select name="aluminium" required>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
          
          <label>Céramique</label>
          <select name="ceramique" required>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
          
          <button type="submit">Générer le Devis</button>
        </form>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// Traitement du devis : calcul, génération du PDF via PDFKit, mise à jour Excel et envoi par email
app.post('/quote', async (req, res) => {
  const {
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    projectType,
    surface,
    ceilingHeight,
    interiorFinish,
    exteriorFinish,
    foundation,
    isolation,
    electricity,
    aluminium,
    ceramique,
    roofCovering
  } = req.body;

  const surfaceNum = parseFloat(surface);
  const ceilingHeightNum = parseFloat(ceilingHeight);

  // Calcul de la quantité d'acier et du coût de la structure
  const STEEL_COEFFICIENT = (projectType === "Maison plein-pied") ? 0.03 : (projectType === "Maison à étages") ? 0.05 : 0;
  const steelWeightNum = surfaceNum * STEEL_COEFFICIENT;
  const fixedPricePerTon = 100000;
  const structureCost = steelWeightNum * fixedPricePerTon;

  // Tarifs pour les finitions (exemple en MUR/m²)
  const interiorFinishCosts = {
    gypsumBoard: 1800,
    nanoBoard: 2800,
    aucun: 0
  };
  const exteriorFinishCosts = {
    crépissage: 1500,
    finishBoard: 1700,
    mgo: 1000
  };
  const roofCoveringCosts = {
    waterproof: 1500,
    ondulées: 2500,
    wallofChina: 3000
  };

  const interiorCost = (interiorFinish === "gypsumBoard") ? surfaceNum * interiorFinishCosts[interiorFinish] * 3 : (interiorFinish === "nanoBoard") ? surfaceNum * interiorFinishCosts[interiorFinish] * 3 : 0;
  const exteriorCost = surfaceNum * exteriorFinishCosts[exteriorFinish];
  const foundationCost = foundation === "oui"
  ? (projectType === "Maison plein-pied"
      ? surfaceNum * 5000
      : projectType === "Maison à étages"
        ? (surfaceNum * 5000) / 2
        : 0)
  : 0;
  const isolationCost = (isolation === "oui") ? surfaceNum * 100 : 0;
  const roofCoveringCost = surfaceNum * roofCoveringCosts[roofCovering];
  const electricityCost = (electricity === "oui") ? surfaceNum * 2500 : 0;
  const aluminiumCost = (aluminium === "oui") ? surfaceNum * 1000 : 0;
  const ceramiqueCost = (ceramique === "oui") ? surfaceNum * 1000 : 0;
  const basePrice = structureCost + interiorCost + exteriorCost + foundationCost +
                    isolationCost + roofCoveringCost + electricityCost + aluminiumCost + ceramiqueCost;
  const pricePerSqm = basePrice / surfaceNum;

  // Génération d'un numéro de devis unique
  const now = new Date();
  const quoteNumber = "DH-" + now.getTime();

  // Récupération des informations du commercial depuis la session
  const salesRep = req.session.salesRep;
  const repKey = req.session.repKey;

  // Organisation du dossier pour sauvegarder le PDF (quotes/Commercial/année/mois)
  const year = now.getFullYear().toString();
  const month = ("0" + (now.getMonth() + 1)).slice(-2);
  const repDir = salesRep.name.replace(/ /g, "_");
  const directoryPath = path.join(__dirname, 'quotes', repDir, year, month);
  fs.mkdirSync(directoryPath, { recursive: true });
  const filename = `quote_${now.getTime()}.pdf`;
  const filePath = path.join(directoryPath, filename);

  // Constitution de l'objet quote (données à transmettre à la génération PDF)
  const quoteData = {
    quoteNumber: quoteNumber,
    salesRep: salesRep,
    client: {
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      address: clientAddress || ""
    },
    date: now.toLocaleDateString('fr-MU'),
    project: {
      type: projectType,
      surface: surfaceNum,
      ceilingHeight: ceilingHeightNum,
      steelWeight: steelWeightNum,
      interiorFinish: interiorFinish,
      exteriorFinish: exteriorFinish,
      foundation: foundation,
      isolation: isolation,
      electricity: electricity,
      aluminium: aluminium,
      ceramique: ceramique,
      roofCovering: roofCovering,
      structureCost: structureCost,
      interiorCost: interiorCost,
      exteriorCost: exteriorCost,
      foundationCost: foundationCost,
      isolationCost: isolationCost,
      electricityCost: electricityCost,
      aluminiumCost: aluminiumCost,
      ceramiqueCost: ceramiqueCost,
      roofCoveringCost: roofCoveringCost,
      basePrice: basePrice,
      pricePerSqm: pricePerSqm
    },
    company: {
      name: 'Housinnovation',
      address: "La Tour Koenig, Lot No: 24F/5 Industrial Park Pointe-aux-sables, 11222, Île Maurice",
      logo: "public/logo.png",
      colors: {
        primary: "#0E8484",
        secondary: "#6D6E71"
      }
    }
  };

  // Mise à jour de la base clients dans le fichier Excel
  updateClientExcel({
    Name: clientName,
    Email: clientEmail,
    Phone: clientPhone,
    Address: clientAddress || "",
    ProjectType: projectType,
    Surface: surfaceNum,
    CeilingHeight: ceilingHeightNum,
    Date: now.toLocaleDateString('fr-MU')
  });

  try {
    // Génération du PDF avec PDFKit
    await generateQuotePDF(quoteData, filePath);

    // Préparation de la signature pour l'email
      let signatureHTML = "";
      if (req.session.repKey === "quentin") {
        signatureHTML = `<div style="font-family:&quot;Rockwell&quot;, sans-serif; font-size:12px; line-height:1.5; color:rgb(51, 51, 51)">
            <table>
                <tbody>
                    <tr>
                        <td style="vertical-align:middle; padding-right:15px">
                            <img src="https://i.imgur.com/MsCuFY2.png" alt="Housinnovation" width="150"><br>
                        </td>
                        <td style="vertical-align:middle; border-left:2px solid rgb(14, 132, 132); padding-left:15px">
                            <div>
                                <b style="font-size:14px; color:rgb(14, 132, 132)">Quentin ROGES</b><br>
                            </div>
                            <div>
                                <i style="color:rgb(109, 110, 113)">Directeur</i><br>
                            </div>
                            <div>
                                <a href="tel:+23058578401" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">+230 5 857-8401</a> |
                                <a href="mailto:q.roges@housinnovation.com" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">q.roges@housinnovation.com</a><br>
                            </div>
                            <div>
                                <a href="https://www.housinnovation.com" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">www.housinnovation.com</a><br>
                            </div>
                            <div>
                                <span style="color:rgb(109, 110, 113); font-size:11px">
                                    Construction de maisons en structure acier • Île Maurice
                                </span><br>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div><br></div>`;
      } else if (req.session.repKey === "lindsay") {
        signatureHTML = `<div style="font-family:&quot;Rockwell&quot;, sans-serif; font-size:12px; line-height:1.5; color:rgb(51, 51, 51)">
            <table>
                <tbody>
                    <tr>
                        <td style="vertical-align:middle; padding-right:15px">
                            <img src="https://i.imgur.com/MsCuFY2.png" alt="Housinnovation" width="150"><br>
                        </td>
                        <td style="vertical-align:middle; border-left:2px solid rgb(14, 132, 132); padding-left:15px">
                            <div>
                                <b style="font-size:14px; color:rgb(14, 132, 132)">Lindsay DELIA</b><br>
                            </div>
                            <div>
                                <i style="color:rgb(109, 110, 113)">Directeur</i><br>
                            </div>
                            <div>
                                <a href="tel:+23059193689" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">+230 5 919-3689</a> |
                                <a href="mailto:l.delia@housinnovation.com" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">l.delia@housinnovation.com</a><br>
                            </div>
                            <div>
                                <a href="https://www.housinnovation.com" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">www.housinnovation.com</a><br>
                            </div>
                            <div>
                                <span style="color:rgb(109, 110, 113); font-size:11px">
                                    Construction de maisons en structure acier • Île Maurice
                                </span><br>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div><br></div>`;
      } else if (req.session.repKey === "blandine") {
        signatureHTML = `<div style="font-family:&quot;Rockwell&quot;, sans-serif; font-size:12px; line-height:1.5; color:rgb(51, 51, 51)">
            <table>
                <tbody>
                    <tr>
                        <td style="vertical-align:middle; padding-right:15px">
                            <img src="https://i.imgur.com/MsCuFY2.png" alt="Housinnovation" width="150"><br>
                        </td>
                        <td style="vertical-align:middle; border-left:2px solid rgb(14, 132, 132); padding-left:15px">
                            <div>
                                <b style="font-size:14px; color:rgb(14, 132, 132)">Blandine NI</b><br>
                            </div>
                            <div>
                                <i style="color:rgb(109, 110, 113)">Directeur</i><br>
                            </div>
                            <div>
                                <a href="tel:+23055027337" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">+230 5 502-7337</a> |
                                <a href="mailto:b.ni@housinnovation.com" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">b.ni@housinnovation.com</a><br>
                            </div>
                            <div>
                                <a href="https://www.housinnovation.com" style="color:rgb(14, 132, 132); text-decoration:none" target="_blank">www.housinnovation.com</a><br>
                            </div>
                            <div>
                                <span style="color:rgb(109, 110, 113); font-size:11px">
                                    Construction de maisons en structure acier • Île Maurice
                                </span><br>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div><br></div>`;
      } else {
        signatureHTML = `<p>Cordialement,<br>${req.session.salesRep.name}</p>`;
      }

    // Envoi de l'email avec le devis en pièce jointe
    const transporter = nodemailer.createTransport(smtpCredentials[repKey]);
    const mailOptions = {
      from: salesRep.email,
      to: clientEmail,
      subject: `Votre devis Housinnovation - Numéro: ${quoteNumber}`,
      html: `<p>Bonjour,</p>
             <p>Veuillez trouver ci-joint votre devis.</p>
             ${signatureHTML}`,
      attachments: [{ filename: filename, path: filePath }]
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Erreur d'envoi d'email :", error);
      } else {
        console.log("Email envoyé :", info.response);
      }
    });

    // Affichage d'une page résultat avec lien de téléchargement du PDF
    const resultHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Devis Généré</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
          .button { padding: 10px 20px; margin: 5px; background-color: #0E8484; color: #fff; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>Devis généré avec succès !</h1>
        <p>Vous pouvez télécharger votre devis en cliquant sur le lien ci-dessous :</p>
        <a class="button" href="/quotes/${repDir}/${year}/${month}/${filename}" target="_blank">Télécharger le Devis (PDF)</a>
        <p>Le devis vous a également été envoyé par email.</p>
        <a class="button" href="/">Nouveau devis</a>
      </body>
      </html>
    `;
    res.send(resultHtml);
  } catch (e) {
    console.error("Erreur lors de la génération du PDF :", e);
    res.send("Erreur lors de la génération du PDF.");
  }
});

// Servir statiquement les fichiers PDF générés
app.use('/quotes', express.static(path.join(__dirname, 'quotes')));

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
