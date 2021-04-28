const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

/* Création des models des utilisateurs */

const userSchema = new mongoose.Schema({
    username : String,
    password : String
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);