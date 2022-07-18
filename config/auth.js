const config = require("../config/keys");
const User = require("../models/user.model");
const Role = require("../models/role.model");
const OCS = require("../models/ocs.model");
const Project = require("../models/project.model");
const url = require('url');
const { encrypt, decrypt } = require('../config/crypt');

module.exports = {
  ensureAuthenticated: function (req, res, next) {
    if (req.isAuthenticated()) {
      res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0') // no cache so when logged out, cant browser back button to reload page, forces reload
      return next();
    }
    if(req.url=="/"||req.url=='/login'||req.url=='/logout'||req.url=='/register'||req.url=='/my_OCSes'||req.url.slice(0,5)=='/view'){
      req.flash('error_msg', 'Зарегестрируйтесь, чтобы посетить данный ресурс');
      return res.redirect('/login');
    }
    else{
      answer = {redir:'/login',msg:'Зарегестрируйтесь, чтобы посетить данный ресурс'};
      return res.send(JSON.stringify(answer))
    }
    
    
  },
  forwardAuthenticated: function (req, res, next) {
    if (!req.isAuthenticated()) {
      return next();
    }
    return res.redirect('/my_OCSes');
  },
  hasThisAccess: async function (req, res, next) {
    q = req.url.split("/")[2];//index of req accesss
    let url_check= false;//check that requested page is /view type to do redirect instead of send
    if(req.url.slice(0,5)=='/view'){
      url_check= true;
    }
    try {
      p = decrypt(req.params.ids)
    } catch (e) {
      console.log(req.params.ids)
      console.log(e)
      if(url_check){
        req.flash('error_msg', 'Ошибка 400: Некорректный запрос');
        return res.redirect('/my_OCSes');
      }
      else{
        answer = {redir:'/my_OCSes',msg:'Ошибка 400: Некорректный запрос'};
        return res.send(JSON.stringify(answer))
      }
    }
    if (p[0].toString(16).length !== 24){
      if(url_check){
        req.flash('error_msg', 'Ошибка 400:! Некорректный запрос');
        return res.redirect('/my_OCSes');
      }
      else{
        answer = {redir:'/my_OCSes',msg:'Ошибка 400:! Некорректный запрос'};
        return res.send(JSON.stringify(answer))
      }
    }
    let cur_user = await User.findById(req.user._id).populate("l_roles", "-__v -users")
    let grole = await Role.findOne({ ocsId: p[0], projectId: null, users: req.user._id }).select("name access")    
    if (!cur_user) {
      if(url_check){
        req.flash('error_msg', 'Данного пользователя не существует');
        return res.redirect('/login');
      }
      else{
        answer = {redir:'/login',msg:'Данного пользователя не существует'};
        return res.send(JSON.stringify(answer))
      }
    }
    if (grole == null) {
      if(url_check){
        req.flash('error_msg', 'В данной СУО вы не находитесь');
        return res.redirect('/my_OCSes');
      }
      else{
        answer = {redir:'/my_OCSes',msg:'В данной СУО вы не находитесь'};
        return res.send(JSON.stringify(answer))
      }
    }
    if (grole.access[0] == 0) {
      if(url_check){
        req.flash('error_msg', 'В данной СУО вы заблокированы');
        return res.redirect('/my_OCSes');
      }
      else{
        answer = {redir:'/my_OCSes',msg:'В данной СУО вы заблокированы'};
        return res.send(JSON.stringify(answer))
      }
    }   
      //проверка что роль имеет глобальный доступ к этому действию
      if (grole.access[q] == 1) {
        return next();
      }  
      //проверка что есть локальный для проекта доступ
      if (p[1].toString(16).length !== 24){
        if(url_check){
          req.flash('error_msg', 'Ошибка 400: Некорректный запрос');
          return res.redirect('/my_OCSes');
        }
        else{
          answer = {redir:'/my_OCSes',msg:'Ошибка 400: Некорректный запрос'};
          return res.send(JSON.stringify(answer))
        }
      }
      let project = await Project.findById(p[1])
      if (!project) {
        if(url_check){
          req.flash('error_msg', 'Проект не существует.');
          return res.redirect('/ocs/view/0/' + encrypt(p[0]));
        }
        else{
          answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Проект не существует.'};
          return res.send(JSON.stringify(answer))
        }        
      }
      let lrole;
      for (let i = 0; i < cur_user.l_roles.length; i++) {
        if (cur_user.l_roles[i].ocsId == p[0] && cur_user.l_roles[i].projectId == p[1]) {
          lrole=cur_user.l_roles[i];
          break;
        }
      }
      if (!lrole) {
        if(url_check){
          req.flash('error_msg', 'У Вас нет роли в этом проекте');
          return res.redirect('/ocs/view/0/' + encrypt(p[0]));
        }
        else{
          answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'У Вас нет роли в этом проекте'};
          return res.send(JSON.stringify(answer))
        }   
      }
      if (lrole.access[1]==1 && lrole.access[q] == 1) {
        return next();
      }
      else {
        if(url_check){
          req.flash('error_msg', 'Ваша роль не имеет к этому доступ');
          if (lrole.access[1]==1){
            return res.redirect('/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]));
          }   
          else {
            return res.redirect('/ocs/view/0/' + encrypt(p[0]));
          }          
        }
        else{      
          if (lrole.access[1]==1){
            answer = {redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),msg:'Ваша роль не имеет к этому доступ'};
            return res.send(JSON.stringify(answer))
          }   
          else {
            answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ваша роль не имеет к этому доступ'};
            return res.send(JSON.stringify(answer))
          }   
        }
      }
  },
};
