const mongoose = require('mongoose');

const devisSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  createur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: {
    nom: { type: String, required: true },
    email: String,
    telephone: String,
    adresse: String
  },
  details: {
    surface: { type: Number, required: true },
    hauteur: { type: Number, required: true },
    typeToiture: { type: String, required: true },
    options: [String]
  },
  calculs: {
    poidsAcier: Number,
    volumeBeton: Number,
    surfaceToiture: Number
  },
  total: {
    acier: Number,
    beton: Number,
    toiture: Number,
    mainOeuvre: Number
  },
  totalHT: Number,
  tva: Number,
  totalTTC: Number
});

module.exports = mongoose.model('Devis', devisSchema);