const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateDevisPDF = (devis, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // En-tête avec logo
    doc.image(path.join(__dirname, '../public/images/logo-housinnovation.png'), 50, 45, { width: 150 });
    
    // Titre et numéro
    doc.fillColor('#0E8484')
       .fontSize(20)
       .text('DEVIS POUR MAISON EN STRUCTURE ACIER', 200, 50, { align: 'right' });
    
    doc.fontSize(10)
       .fillColor('#6D6E71')
       .text(`Devis N°: ${devis.numero}`, 200, 80, { align: 'right' })
       .text(`Date: ${new Date(devis.date).toLocaleDateString('fr-FR')}`, 200, 95, { align: 'right' });

    // Informations client et société
    doc.moveDown(2)
       .fontSize(12)
       .fillColor('#0E8484')
       .text('INFORMATIONS CLIENT', { underline: true })
       .fillColor('#6D6E71')
       .text(devis.client.nom)
       .text(`Email: ${devis.client.email || 'Non renseigné'}`)
       .text(`Téléphone: ${devis.client.telephone || 'Non renseigné'}`)
       .text(`Adresse: ${devis.client.adresse || 'Non renseigné'}`)
       .moveDown()
       .fillColor('#0E8484')
       .text('HOUSINNOVATION LTD', { underline: true })
       .fillColor('#6D6E71')
       .text('La Tour Koenig, Lot No: 24F/5 Industrial Park')
       .text('Pointe-aux-sables, 11222, Île Maurice')
       .text(`Commercial: ${devis.createur.nom}`)
       .text(`Email: ${devis.createur.email}`)
       .text(`Téléphone: ${devis.createur.telephone}`)
       .moveDown();

    // Détails du projet
    doc.fillColor('#0E8484')
       .text('DÉTAILS DU PROJET', { underline: true })
       .fillColor('#6D6E71')
       .text(`Surface: ${devis.details.surface} m²`)
       .text(`Hauteur: ${devis.details.hauteur} m`)
       .text(`Type de toiture: ${devis.details.typeToiture}`)
       .moveDown();

    // Tableau des prix
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 250;
    const col3 = 350;
    const col4 = 450;

    // En-tête du tableau
    doc.fillColor('#0E8484')
       .font('Helvetica-Bold')
       .text('Description', col1, tableTop)
       .text('Quantité', col2, tableTop)
       .text('Prix unitaire (Rs)', col3, tableTop)
       .text('Total (Rs)', col4, tableTop)
       .font('Helvetica')
       .fillColor('#6D6E71');

    // Lignes du tableau
    let y = tableTop + 25;
    const lignes = [
      ['Acier structurel', `${devis.calculs.poidsAcier.toFixed(2)} kg`, '350', devis.total.acier.toFixed(2)],
      ['Béton pour fondations', `${devis.calculs.volumeBeton.toFixed(2)} m³`, '8,000', devis.total.beton.toFixed(2)],
      ['Toiture', `${devis.calculs.surfaceToiture.toFixed(2)} m²`, '1,200', devis.total.toiture.toFixed(2)],
      ['Main d\'œuvre', `${(devis.details.surface * 10).toFixed(2)} heures`, '1,500', devis.total.mainOeuvre.toFixed(2)]
    ];

    lignes.forEach(ligne => {
      doc.text(ligne[0], col1, y)
         .text(ligne[1], col2, y)
         .text(ligne[2], col3, y)
         .text(ligne[3], col4, y);
      y += 25;
    });

    // Totaux
    doc.moveTo(50, y).lineTo(550, y).stroke('#0E8484');
    y += 20;
    
    doc.font('Helvetica-Bold')
       .text('Total HT:', col3, y)
       .text(`${devis.totalHT.toFixed(2)} Rs`, col4, y);
    
    y += 25;
    doc.text('TVA (15%):', col3, y)
       .text(`${devis.tva.toFixed(2)} Rs`, col4, y);
    
    y += 25;
    doc.fillColor('#0E8484')
       .text('Total TTC:', col3, y)
       .text(`${devis.totalTTC.toFixed(2)} Rs`, col4, y);

    // Conditions et signature
    doc.moveDown(2)
       .fillColor('#6D6E71')
       .text('Conditions:', { underline: true })
       .text('- Validité du devis: 30 jours')
       .text('- Paiement: 30% à la commande, 70% à la livraison')
       .text(`- Délai estimé: ${Math.ceil(devis.details.surface / 20)} semaines`)
       .moveDown();

    doc.text(`Fait à Pointe-aux-sables, le ${new Date(devis.date).toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(3);
    doc.text('Pour HousInnovation Ltd,', { align: 'right' });
    doc.moveDown(1);
    doc.text('_________________________', { align: 'right' });
    doc.text(devis.createur.nom, { align: 'right' });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

module.exports = { generateDevisPDF };