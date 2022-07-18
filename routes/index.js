const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../config/crypt');
const passport = require('passport');
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
var mongoose = require('mongoose'),
  ObjectId = mongoose.Types.ObjectId;
// Load  models
const User = require("../models/user.model");
const Role = require("../models/role.model");
const OCS = require("../models/ocs.model");
// Welcome Page
router.get('/', forwardAuthenticated, (req, res) => res.render('Start',{ //welcome
  i:1
}));

// Login Page
router.get('/login', forwardAuthenticated, (req, res) => res.render('Start',{
  i:2
})); //login

// Register Page
router.get('/register', forwardAuthenticated, (req, res) => res.render('Start',{
  i:3
})); //register

// Register
router.post('/register', async (req, res, next) => {
  const { name, email, ocsName, password, password2, agreement } = req.body;
  let errors = [];
  if (!name || !email || !ocsName || !password || !password2 || !agreement) {
    errors.push({ msg: 'Заполните все поля' });
  }
  if (name.length < 6 || name.length > 35) {
    errors.push({ msg: 'Обращение к Вам должно быть не меньше 6 и не больше 35 символов' });
  }
  if (ocsName.length < 3 || ocsName.length > 60) {
    errors.push({ msg: 'Название компании должно быть не меньше 3 и не больше 60 символов' });
  }
  if (!ocsName.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push({ msg: 'Название компании должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела' });
  }
  if (!name.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push({ msg: 'Обращение к Вам должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела' });
  }
  if (password != password2) {
    errors.push({ msg: 'Пароли не совпадают' });
  }
  if (!email.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)) {
    errors.push({ msg: 'Некорректная электронная почта' });
  }

  if (!password.match(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)) {
    errors.push({ msg: 'Пароль от 8 символов,1 буквы,1 цифры и 1 спецсимвола : @$!%*#?&' });
  }
  let uu = await User.findOne({ name: name });
  if (uu) {
    errors.push({ msg: 'Пользователь с таким ником уже существует' });
  }
  let u = await User.findOne({ email: email });
  if (u) {
    errors.push({ msg: 'Почта уже существует' });
  }
  if (errors.length > 0) {
    res.render('Start',{
      i:3,
      errors,
      name: name,
      email,
      ocsName,
      password,
      password2,
      agreement
    });
  } else {
    try {
      const user = new User({
        name: name,
        email,
        password
      });
      const hash = bcrypt.hashSync(user.password, bcrypt.genSaltSync(10));
      user.password = hash;
      const ocs = new OCS({
        name: ocsName,
        creator_id: user.id,
        g_roles: [],
        projects: []
      });
      const role = new Role({
        name: "admin",
        ocsId: ocs._id,
        access: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        users: []
      });
      const roleBanned = new Role({
        name: "banned",
        ocsId: ocs._id,
        access: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        users: []
      })
      const roleCanEnter = new Role({
        name: "canEnter",
        ocsId: ocs._id,
        access: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        users: []
      })
      user.g_roles.push(role);
      role.users.push(user);
      await role.save().catch(err => console.log(err));
      await roleBanned.save().catch(err => console.log(err));
      await roleCanEnter.save().catch(err => console.log(err));
      await user.save().catch(err => console.log(err));
      ocs.g_roles.push(role);
      ocs.g_roles.push(roleBanned);
      ocs.g_roles.push(roleCanEnter);
      await ocs.save().catch(err => console.log(err));
      req.flash('success_msg', 'Вы зарегистрированы');
     return res.redirect('/login');
    } catch (err) {
      console.error(err)
     return res.redirect('/login');
    }
  }
});

// Login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/my_OCSes',
    failureRedirect: '/login',
    failureFlash: true
  })(req, res, next);
});

// Logout
router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success_msg', 'Успех: Вы вышли');
  res.redirect('/login');
});

router.put('/editUser', ensureAuthenticated, async (req, res) => {
  const { name, email, password, password2 } = req.body.d;
  let errors = [];
  if (!name || !email || !password || !password2) {
    errors.push('Заполните все поля');
  }
  if (name.length < 6 || name.length > 35) {
    errors.push('Обращение к Вам должно быть не меньше 6 и не больше 35 символов');
  }
  if (!name.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push('Обращение к Вам должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела');
  }
  if (password != password2) {
    errors.push('Пароли не совпадают' );
  }
  if (!email.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)) {
    errors.push('некорректная электронная почта' );
  }
  if (!password.match(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)) {
    errors.push('Пароль от 8 символов,1 буквы,1 цифры и 1 спецсимвола : @$!%*#?&' );
  }
  let user = await User.findById(req.user._id)
  if (!user) {
    answer = {redir:"/login",msg:'Пользователь не существует.Перезайдите'};
    req.logout();
    return res.send(JSON.stringify(answer))
  }
  else if (user.name != name && await User.findOne({name: name})){
    errors.push('Смена на данный ник не возможна,он занят');
  }
  else if (user.email != email && await User.findOne({email: email})){
    errors.push( 'Смена на данную почту не возможна,она занята' );
  }

  if (errors.length > 0) {
    answer = {msg:errors};
    return res.send(JSON.stringify(answer))
  } else {
    try {
        const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
        user = await User.findByIdAndUpdate(req.user._id, { $set: { name: name, password: hash, email: email } }, {
          new: true,
          runValidators: true,
        })
        answer = {redir:"/login",msg:'Успех: Пользователь изменен'};
        req.logout();
        return res.send(JSON.stringify(answer)) 
    } catch (err) {
      console.error(err)
      answer = {redir:'/my_OCSes',msg:'Ошибка: Пользователь не изменен'};
      return res.send(JSON.stringify(answer))
    }
  }
});
router.delete('/deleteUser', ensureAuthenticated, async (req, res) => {
  try {
    let user = await User.findById(req.user._id)
    if (!user) {      
      req.logout();
      req.flash('error_msg', 'Пользователь не существует.Перезайдите');
      res.redirect('/');
    }
    else{
      await Role.updateMany(
        { users: user._id },
        {
          $pull: {
            users: user._id
          }
        })
      await User.deleteOne({ _id: user._id })
      req.logout();
      req.flash('success_msg', 'Успех: Пользователь удален');
      res.redirect('/');
    }    
  } catch (err) {
    console.error(err)
    res.redirect('/');
  }
})
// my_OCSes
router.get('/my_OCSes', ensureAuthenticated, async (req, res) => {
  try {
    //deleting ocs in which user banned from choosing
    var ocses = req.user.g_roles.filter(gr => gr.access[0] != false);
    var ocsesId=[]
    for (let i = 0; i < ocses.length; i++) {
        ocsesId.push(ObjectId(ocses[i].ocsId));      
    }
    if (ocsesId.length == 0) {
      res.render('Start', {
        i:4,
        user: req.user,
        ids: null,
        his_ocses: []
      })
    } else {
      let ocses = await OCS.find({ _id: { $in: ocsesId } }, '_id name creator_id')
      if (ocses.length == 0) {
        res.render('Start', {
          i:4,
          user: req.user,
          ids: null,
          his_ocses: []
        })
      } else {
        let ids = [];
        for (let x in ocses) {
          ids.push(encrypt(ocses[x]._id.toString()))
        }
        res.render('Start', {
          i:4,
          user: req.user,
          ids: ids,
          his_ocses: ocses
        })
      }
    }
  } catch (e) {
    console.log(e)
    req.logout();
    req.flash('error_msg', "Не получилось загрузить Ваши СУО");
    res.redirect('/login');
  }
});
// createOCS
router.post('/createOCS', ensureAuthenticated, async (req, res) => {
  const { d } = req.body;
  if (!d) {
    answer = {msg:'Заполните поле'};
    res.send(JSON.stringify(answer))
  }
  else if (d.length < 3 || d.length > 60) {
    answer = {msg:'Название должно быть не меньше 3 и не больше 30 символов'};
    res.send(JSON.stringify(answer))
  }
  else if (!d.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    answer = {msg:'Название компании должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела'};
    res.send(JSON.stringify(answer))
  }
  else {
    let u_groles = await Role.find({ projectId: null, users: req.user._id }).select("ocsId").lean();
    for (let i in u_groles) {
      u_groles[i] = u_groles[i].ocsId;
    }
    let u_ocses = await OCS.find({ _id: { $in: u_groles }, name: d })
    if (u_ocses.length > 0) {
      answer = {msg:'Есть уже СУО с таким именем у Вас'};
      res.send(JSON.stringify(answer))
    }
    else {
      try {
        let user = await User.findById(req.user._id).populate("g_roles")
        if (!user) {
          answer = {redir:"/login",msg:'Пользователь не существует.Перезайдите'};
          req.logout();
          res.send(JSON.stringify(answer))
        }
        const ocs = new OCS({
          name: d,
          creator_id: user.id,
          g_roles: [],
          projects: []
        });
        const role = new Role({
          name: "admin",
          ocsId: ocs._id,
          access: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          users: []
        });
        const roleBanned = new Role({
          name: "banned",
          ocsId: ocs._id,
          access: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          users: []
        })
        const roleCanEnter = new Role({
          name: "canEnter",
          ocsId: ocs._id,
          access: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          users: []
        })
        user.g_roles.push(role);
        role.users.push(user);
        await role.save().catch(err => console.log(err));
        await roleBanned.save().catch(err => console.log(err));
        await roleCanEnter.save().catch(err => console.log(err));
        await user.save().catch(err => console.log(err));
        ocs.g_roles.push(role);
        ocs.g_roles.push(roleBanned);
        ocs.g_roles.push(roleCanEnter);
        await ocs.save().catch(err => console.log(err));
        answer = {n:ocs.name,ids:encrypt(ocs._id.toString()),msg:'Успех: СУО создано'};
        return res.send(JSON.stringify(answer))
      } catch (err) {
        console.log(err)
        answer = {redir:'/my_OCSes',msg:'СУО не создалось'};
        return res.send(JSON.stringify(answer))
      }
    }
  }
});


module.exports = router;
