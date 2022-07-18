const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

// Load User model
const User = require('../models/user.model');
module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
      // Match user
      User.findOne({
        email: email
      })
      .populate("g_roles","-__v -users")
      .populate("l_roles","-__v -users")
      .then(user => {
        if (!user) {
          return done(null, false, { message: 'Эта почта не зарегестрирована' });
        }
        // Match password
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) throw err;
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: 'Пароль не верный' });
          }
        });
      });
    })
  );

  passport.serializeUser(function(user, done) {
  return done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id)
    .populate("g_roles","-__v -users")
    .populate("l_roles","-__v -users")
    .then(user => {
      if (!user) {
        return done(null, false, { message: 'Нету пользователя' });
      }
      else {
        return done(null, user);
      }
    });
  });
};
