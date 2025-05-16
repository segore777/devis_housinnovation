const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    prenom: { type: String, required: true },
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telephone: { type: String },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Hash du mot de passe avant sauvegarde
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

module.exports = mongoose.model('User', userSchema);