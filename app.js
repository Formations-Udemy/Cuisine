process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';

const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const randToken = require('rand-token');
const nodemailer = require('nodemailer');
/* const bcrypt = require('bcrypt'); */

// Permet d'avoir des sessions
const session = require('express-session');
// Passport sert à l'authentification
const passport = require('passport');
// Passport-local-mongoose gère la connexion entre Passport et Mongoose
const passportLocalMongoose = require('passport-local-mongoose');

// Initialisation d'express
const app = express();

// --- SESSION --- : Initialisation d'express-session
app.use(session({
    secret : "mysecret",
    resave : false,
    saveUninitialized : false
}));

// --- PASSPORT --- : Initialisation de passport
app.use(passport.initialize());
// Liaison entre passport et le bundle session
app.use(passport.session());

//methodOverride permet de faire la même chose que postman
const methodOverride = require('method-override');
//Initialisation de methodOverride
app.use(methodOverride('_method'));

// connect-flash permet d'envoyer des messages flashs
const flash = require('connect-flash');
// Initialisation de flash
app.use(flash());

app.use(function(req, res, next){
    res.locals.currentUser = req.user; //permet d'avoir les infos du user connecté // res.locals est une superglobale comme SESSION en PHP
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});

const port = 3000;

// Initialisation d'EJS
app.set('view engine', 'ejs');

// Public folder en static (pour avoir accès au CSS)
app.use(express.static('public'));

//Instanciation de body-parser
app.use(bodyParser.urlencoded({extended : false}));

// --- MODELS --- : Importation des différents models
const User = require("./models/user.js");
const Reset = require("./models/reset.js");
const Receipe = require("./models/receipe.js");
const Favourite = require("./models/favourite.js");
const Ingredient = require("./models/ingredient.js");
const Schedule = require("./models/schedule.js");
const receipe = require('./models/receipe.js');

//Initialisation de MONGOOSE et connexion au cloud mongoDB Atlas
mongoose.connect('mongodb+srv://admin_steph:6m5V2cSB@cluster0.ywmsi.mongodb.net/cooking?retryWrites=true&w=majority', {useNewUrlParser: true, useUnifiedTopology: true});

// --- PASSPORT LOCAL MONGOOSE --- : Permet à passport de gérer nos requêtes, nos authentifications
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

/* ---- DEBUT DES ROUTES ---- */
app.get('/', function(req, res){
    res.render('index');
});

/*  DEBUT SIGNUP */
app.get('/signup', function(req, res){
    res.render('signup');
});

app.post('/signup', function(req, res){
    const newUser = new User({
        username : req.body.username
    });
    User.register(newUser, req.body.password, function(err, user){
        if (err) {
            console.log(err);
            res.render('signup');
        }else{
            passport.authenticate('local')(req, res, function(){
                res.redirect('/login');
            });
        }
    });

    /* Méthode avec utilisation de bcrypt
        const saltRounds = 10;
        bcrypt.hash(req.body.password, saltRounds, function(err, hash){
            const user = {
                username : req.body.username,
                password : hash
            };
            User.create(user, function(err){
                if (err) {
                    console.log(err);
                } else {
                    res.render('index');
                }
            });
        }); */
});
/* FIN SIGNUP */

/* DEBUT LOGIN */
app.get('/login', function(req, res){
    res.render('login');
});

app.post('/login', function(req, res){
    const user = new User({
        username : req.body.username,
        password : req.body.password
    });

    req.login(user, function(err){
        if (err) {
            console.log(err);
        }else{
            passport.authenticate('local')(req, res, function(){
                res.redirect('/dashboard');
            });
        }
    });

    /* Méthode avec utilisation de bcrypt:
        User.findOne({username : req.body.username}, function(err, foundUser){
        if (err) {
            console.log(err);
        }else{
            if (foundUser) {
                bcrypt.compare(req.body.password, foundUser.password, function(err, result){
                    if (result == true) {
                        console.log("tu es connecté")
                        res.render('index');
                    }
                });
            }
        }
    }); */
});
/* FIN LOGIN */

/* DEBUT LOGOUT */
app.get('/logout', function(req, res){
    req.logout();
    req.flash('success', 'Thank you, you are now logged out !');
    res.redirect('/login');
});
/* FIN LOGOUT */

/* DEBUT MOT DE PASSE OUBLIE */
app.get('/forgot', function(req, res){
    res.render('forgot');
});

app.post('/forgot', function(req, res){
    User.findOne({username : req.body.username}, function(err, userFound){
        if (err) {
            console.log(err);
            res.redirect('/signup');
        }else{
            const token = randToken.generate(16);
            Reset.create({
                username : userFound.username,
                resetPasswordToken : token,
                resetPasswordExpires : Date.now() + 3600000
            });
            const transporter = nodemailer.createTransport({
                host : 'smtp.gmail.com',
                auth : {
                    user : 'cooking.nodejs@gmail.com',
                    pass : 'Scorpions!07'
                }
            });
            const mailOptions = {
                from : 'cooking.nodejs@gmail.com',
                to : req.body.username,
                subject : 'link to reset your password',
                text : 'Click the link to reset your password : http://localhost:3000/reset/' + token
            };

            transporter.sendMail(mailOptions, function(error, response){
                if (error) {
                    console.log(error);
                }else{
                    req.flash('success', 'Successfully sent you an email !');
                    res.redirect('/login');
                }
            });
        }
    });
});

app.get('/reset/:token', function(req, res){
    Reset.findOne({
        resetPasswordToken : req.params.token,
        resetPasswordExpires : {$gt : Date.now()}
    }, function(err, obj){
        if (err) {
            console.log('token expired');
            res.redirect('/login');
        }else{
            res.render('reset', {token : req.params.token});
        }
    });
});

app.post('/reset/:token', function(req, res){
    Reset.findOne({
        resetPasswordToken : req.params.token,
        resetPasswordExpires : {$gt : Date.now()}
    }, function(err, obj){
        if (err) {
            console.log('token expired');
            res.redirect('/login');
        }else{
            if (req.body.password == req.body.password2) {
                User.findOne({username : obj.username}, function(err, user){
                    if (err) {
                        console.log(err);
                    }else{
                        user.setPassword(req.body.password, function(error){
                            if (error) {
                                console.log(error);
                            }else{
                                user.save();
                                const updatedReset = {
                                    resetPasswordToken : null,
                                    resetPasswordExpires : null
                                };
                                Reset.findOneAndUpdate({resetPasswordToken : req.params.token}, updatedReset, function(erreur, obj1){
                                    if (erreur) {
                                        console.log(erreur);
                                    }else{
                                        res.redirect('/login');
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
    });
});
/* FIN MOT DE PASSE OUBLIE */


/* ROUTE POUR UN CLIENT CONNECTE */

//Fonction de connexion
function isLoggedIn(req, res, next){
    if (req.isAuthenticated()) {
        return next();
    }else{
        req.flash('error', 'Please login first !');
        res.redirect('/login');
    }
};

app.get('/dashboard', isLoggedIn, function(req, res){
    req.flash('success', 'Vous êtes connecté');
    res.render('dashboard');
});

/* RECEIPE */
app.get('/dashboard/myreceipes', isLoggedIn, function(req, res){
    Receipe.find({
        user: req.user.id
    }, function(err, receipe){
        if (err) {
            console.log(err);
        }else{
            res.render('receipe', {receipe: receipe});
        }
    });
});

app.get('/dashboard/newreceipe', isLoggedIn, function(req, res){
    res.render('newreceipe');
});

app.post('/dashboard/newreceipe', function(req, res){
    const newReceipe = {
        name: req.body.receipe,
        image: req.body.logo,
        user: req.user.id
    }
    Receipe.create(newReceipe, function(err, newReceipe){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'New receipe added !');
            res.redirect('/dashboard/myreceipes');
        }
    });
});

app.get('/dashboard/myreceipes/:id', function(req, res){
    Receipe.findOne({user: req.user.id, _id: req.params.id}, function(err, receipeFound){
        if (err) {
            console.log(err);
        }else{
            Ingredient.find({
                user: req.user.id,
                receipe: req.params.id
            }, function(error, ingredientFound){
                if (error) {
                    console.log(error);
                }else{
                    res.render('ingredients', {
                        ingredient: ingredientFound,
                        receipe: receipeFound
                    });
                }
            });
        }
    });
});

// Supprimer une recette
app.delete('/dashboard/myreceipes/:id', isLoggedIn, function(req, res){
    Receipe.deleteOne({_id: req.params.id}, function(err){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'The receipe has been deleted !');
            res.redirect('/dashboard/myreceipes');
        }
    });
});

/* FAVOURITE */
app.get('/dashboard/favourites', isLoggedIn, function(req, res){
    Favourite.find({user: req.user.id}, function(err, favouriteFound){
        if (err) {
            console.log(err)
        }else{
            res.render('favourites', {favourite: favouriteFound});
        }
    });
});

app.get('/dashboard/favourites/newfavourite', isLoggedIn, function(req, res){
    res.render('newfavourite');
});

// Ajouter une recette favorite
app.post('/dashboard/favourites', isLoggedIn, function(req, res){
    const newFavourite = {
        image: req.body.image,
        title: req.body.title,
        description: req.body.description,
        user: req.user.id
    };
    Favourite.create(newFavourite, function(err, newFavourite){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'Receipe added to your favourite ;) !');
            res.redirect('/dashboard/favourites');
        }
    });
});

// Supprimer une recette favorite
app.delete('/dashboard/favourites/:id', isLoggedIn, function(req, res){
    Favourite.deleteOne({_id: req.params.id}, function(err){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'Your fav has been deleted !');
            res.redirect('/dashboard/favourites');
        }
    })
});


/* INGREDIENTS */

//Afficher les ingredients
app.get('/dashboard/myreceipes/:id/newingredient', function(req, res){
    Receipe.findById({_id: req.params.id}, function(err, receipeFound){
        if (err) {
            console.log(err);
        }else{
            res.render('newingredient', {receipe: receipeFound});
        }
    });
});

// Ajouter un ingrédient
app.post('/dashboard/myreceipes/:id', function(req, res){
    const newIngredient = {
        name: req.body.name,
        bestDish: req.body.dish,
        user: req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id
    };
    Ingredient.create(newIngredient, function(err, newIngredient){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'Your ingredient has been added !');
            res.redirect('/dashboard/myreceipes/' + req.params.id);
        }
    });
});

// Supprimer un ingrédient
app.delete('/dashboard/myreceipes/:id/:ingredientId', isLoggedIn, function(req, res){
    Ingredient.deleteOne({_id: req.params.ingredientId}, function(err){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'Your ingredient has been deleted successfuly !');
            res.redirect('/dashboard/myreceipes/' + req.params.id);
        }
    });
});

// Modifier un ingrédient
app.post('/dashboard/myreceipes/:id/:ingredientId/edit', isLoggedIn, function(req, res){
    Receipe.findOne({user: req.user.id, _id: req.params.id}, function(err, receipeFound){
        if (err) {
            console.log(err);
        }else{
            Ingredient.findOne({
                _id: req.params.ingredientId,
                receipe: req.params.id
            }, function(error, ingredientFound){
                if (error) {
                    console.log(error);
                }else{
                    res.render('edit', {
                        ingredient: ingredientFound,
                        receipe: receipeFound
                    })
                }
            });
        }
    });
});

app.put('/dashboard/myreceipes/:id/:ingredientId', isLoggedIn, function(req, res){
    const ingredient_updated = {
        name : req.body.name,
        bestDish: req.body.dish,
        user: req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id,
    };
    Ingredient.findByIdAndUpdate({_id: req.params.ingredientId}, ingredient_updated, function(err, updatedIngredient){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'Ingredient successfully updated');
            res.redirect('/dashboard/myreceipes/' + req.params.id);
        }
    });
});

/* SCHEDULE */
app.get('/dashboard/schedule', isLoggedIn, function(req, res){
    Schedule.find({user: req.user.id}, function(err, scheduleFound){
        if (err) {
            console.log(err);
        }else{
            res.render('schedule', {schedule: scheduleFound});
        }
    });
});

app.get('/dashboard/schedule/newschedule', isLoggedIn, function(req, res){
    res.render('newSchedule');
});

// Ajouter un nouveau schedule
app.post('/dashboard/schedule', isLoggedIn, function(req, res){
    const newSchedule = {
        receipeName : req.body.receipename,
        scheduleDate: req.body.scheduleDate,
        user: req.user.id,
        time: req.body.time
    };
    Schedule.create(newSchedule, function(err, scheduleCreate){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'You just added a new schedule');
            res.redirect('/dashboard/schedule');
        }
    });
});

// Supprimer un schedule
app.delete('/dashboard/schedule/:id', isLoggedIn, function(req, res){
    Schedule.deleteOne({_id: req.params.id}, function(err, scheduleFound){
        if (err) {
            console.log(err);
        }else{
            req.flash('success', 'Your schedule has been deleted !');
            res.redirect('/dashboard/schedule');
        }
    })
});

/* FIN ROUTE CLIENT CONNECTE */

app.listen(port, function(req, res){
    console.log('Le serveur tourne au top sur le port ' + port)
});