require('dotenv').config(); // Charge le fichier .env

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer'); // Pour envoyer le devis par e-mail
const puppeteer = require('puppeteer'); // Pour créer un fichier PDF à partir d'un HTML
const XLSX = require('xlsx'); // Pour mettre à jour un fichier Excel

const app = express();
const port = 3000;

// Configuration du moteur de templates et des fichiers statiques
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

// Configuration de la session
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
  lindsay: {
    name: "Lindsay DELIA",
    email: "l.delia@housinnovation.com",
    phone: "+230 5 919 3689"
  },
  blandine: {
    name: "Blandine NI",
    email: "b.ni@housinnovation.com",
    phone: "+230 5 502 7337"
  }
};

// Configuration SMTP spécifique à chaque commercial en utilisant les variables d'environnement
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
  lindsay: {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.LINDSAY_SMTP_USER,
      pass: process.env.LINDSAY_SMTP_PASS
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
  }
};

// Fonction pour mettre à jour (ou créer) la base clients dans un fichier Excel
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

// Route d'accueil : sélection du commercial
app.get('/', (req, res) => {
  res.render('index', { salesReps });
});

app.post('/select', (req, res) => {
  const rep = req.body.rep; // doit être "quentin", "lindsay" ou "blandine"
  if (!salesReps[rep]) {
    return res.send("Commercial non valide.");
  }
  req.session.salesRep = salesReps[rep];
  req.session.repKey = rep;
  res.redirect('/quote');
});

app.get('/quote', (req, res) => {
  if (!req.session.salesRep) return res.redirect('/');
  res.render('quoteForm', { salesRep: req.session.salesRep });
});

// Traitement du devis, génération du PDF et envoi de l'e-mail
app.post('/quote', async (req, res) => {
  // Récupération des données du formulaire  
  const {
    clientName,
    clientEmail,
    clientPhone,
    clientAddress, // facultatif
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

  // Conversion en valeurs numériques
  const surfaceNum = parseFloat(surface);
  const ceilingHeightNum = parseFloat(ceilingHeight);

  // Calcul de la quantité d'acier et du coût de la structure
  const STEEL_COEFFICIENT = (projectType === "Maison plein-pied") ? 0.03 : (projectType === "Maison à étages") ? 0.05 : 0;
  const steelWeightNum = surfaceNum * STEEL_COEFFICIENT;
  const fixedPricePerTon = 50000;
  const structureCost = steelWeightNum * fixedPricePerTon;

  // Tarifs pour les finitions (exemple, en MUR/m²)
  const interiorFinishCosts = {
    gypsumBoard: 1800,
    aucune: 0
  };
  const exteriorFinishCosts = {
    mgo: 1000,
    crépi: 1500,
    finishBoard: 1700
  };
  const roofCoveringCosts = {
    waterproof: 1500,
    ondulées: 2500,
    wallofChina: 3000
  };

  const interiorCost = (interiorFinish === "gypsumBoard") ? surfaceNum * interiorFinishCosts[interiorFinish] * 3 : 0;
  const exteriorCost = surfaceNum * exteriorFinishCosts[exteriorFinish];
  const foundationCost = (foundation === "oui") ? surfaceNum * 5000 : 0;
  const isolationCost = (isolation === "oui") ? surfaceNum * 100 : 0;
  const roofCoveringCost = surfaceNum * roofCoveringCosts[roofCovering];
  const electricityCost = (electricity === "oui") ? surfaceNum * 2500 : 0;
  const aluminiumCost = (aluminium === "oui") ? surfaceNum * 1000 : 0;
  const ceramiqueCost = (ceramique === "oui") ? surfaceNum * 1000 : 0;

  const basePrice = structureCost + interiorCost + exteriorCost + foundationCost +
                    isolationCost + roofCoveringCost + electricityCost + aluminiumCost +ceramiqueCost;

  // Génération d'un numéro de devis unique
  const now = new Date();
  const quoteNumber = "DH-" + now.getTime();

  // Organisation des fichiers PDF dans des dossiers par commercial, année et mois
  const year = now.getFullYear().toString();
  const month = ("0" + (now.getMonth() + 1)).slice(-2);
  const repDir = req.session.salesRep.name.replace(/ /g, "_");
  const directoryPath = path.join(__dirname, 'quotes', repDir, year, month);
  fs.mkdirSync(directoryPath, { recursive: true });
  const filename = `quote_${now.getTime()}.pdf`;
  const filePath = path.join(directoryPath, filename);

  // Constitution de l'objet quoteData à transmettre au template
  const quoteData = {
    quoteNumber: quoteNumber,
    salesRep: req.session.salesRep,
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
    },
    company: {
      name: 'Housinnovation',
      address: "La Tour Koenig, Lot No: 24F/5 Industrial Park Pointe-aux-sables, 11222, Île Maurice",
      logo: "images/logo.jpg",
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

  // Rendu du template EJS "quoteTemplate" pour générer le HTML du devis
  res.render('quoteTemplate', { quote: quoteData }, async (err, html) => {
    if (err) {
      console.error("Erreur lors du rendu de quoteTemplate :", err);
      return res.send("Erreur lors de la génération du devis.");
    }
    try {
      // Lancement de Puppeteer avec les options nécessaires (mode headless et sandbox désactivé)
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4' });
      await browser.close();
      fs.writeFileSync(filePath, pdfBuffer);

      // Préparation de la signature à inclure dans le corps de l'e-mail
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

      // Envoi de l'e-mail avec le devis en pièce jointe et la signature HTML
      const transporter = nodemailer.createTransport(smtpCredentials[req.session.repKey]);
      const mailOptions = {
        from: req.session.salesRep.email,
        to: clientEmail,
        subject: `Votre devis Housinnovation - Numéro: ${quoteData.quoteNumber}`,
        html: `<p>Bonjour,</p>
               <p>Veuillez trouver ci-joint votre devis.</p>
               ${signatureHTML}`,
        attachments: [{ filename: filename, content: pdfBuffer }]
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Erreur d'envoi d'email :", error);
        } else {
          console.log("Email envoyé :", info.response);
        }
      });

      // Affichage de la page de résultat avec un lien pour télécharger le PDF
      res.render('quoteResult', { quote: quoteData, pdfFile: `/quotes/${repDir}/${year}/${month}/${filename}` });
    } catch (e) {
      console.error("Erreur lors de la génération du PDF :", e);
      res.send("Erreur lors de la génération du PDF.");
    }
  });
});

app.use('/quotes', express.static(path.join(__dirname, 'quotes')));

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});