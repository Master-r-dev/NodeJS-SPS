const express = require('express');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../config/crypt');
const router = express.Router();
const { ensureAuthenticated, hasThisAccess,  } = require('../config/auth');
var mongoose = require('mongoose'),
  ObjectId = mongoose.Types.ObjectId;
// Load  models
const User = require("../models/user.model");
const Role = require("../models/role.model");
const OCS = require("../models/ocs.model");
const Project = require("../models/project.model");

/**
* 
* 
* OCS management
* 
* 
*/

// view ocs page // w
router.get('/view/0/:ids', ensureAuthenticated, hasThisAccess, (req, res) => {
  const p = decrypt(req.params.ids)
  OCS.findById(p[0])
    .populate({ path: "g_roles", populate: { path: "users", select: "_id name" } })
    .populate("projects", "_id name desc")
    .exec((err, ocs) => {
      if (!ocs) {
        req.flash('error_msg', "Текущее СУО перестало существовать ");
        res.redirect('/my_OCSes');
      }
      //getting g_role
      for (let i = 0; i < req.user.g_roles.length; i++) {
        if (req.user.g_roles[i].ocsId == p[0]) {
          let k = req.user.g_roles[i];
          req.user.g_roles = [];
          req.user.g_roles.push(k);
          break;
        }
      }
      //getting l_roles
      let g = req.user.l_roles;
      req.user.l_roles = [];
      for (let i = 0; i < g.length; i++) {
        if (g[i].ocsId == p[0]) {
          req.user.l_roles.push(g[i]);
        }
      }
      //console.log(req.user);
      res.render('OCS', {
        user: req.user,
        ocs: ocs,
        encrypt: encrypt
      });
    });
});
// editing OCS (only creator can)
router.put('/editOCS/:ids', ensureAuthenticated, async (req, res) => {
  const p = decrypt(req.params.ids)
  const { d } = req.body;
  if (!d) {
    answer = {msg:'Заполните поле'};
    return res.send(JSON.stringify(answer))
  }
  if (d.length < 3 || d.length > 30) {
    answer = {msg:'Название должно быть не меньше 3 и не больше 30 символов'};
    return res.send(JSON.stringify(answer))
  }
  try {
    let ocs = await OCS.findById(p[0]).lean()
    if (!ocs || ocs.creator_id.toString() != req.user._id.toString()) {
        answer = {
          redir:"/my_OCSes",
          msg:'Текущее СУО перестало существовать   или Вы не являетесь ее создателем'
        };
        return res.send(JSON.stringify(answer))
    } 
    ocs = await OCS.findByIdAndUpdate(p[0], { name: d }, {
      new: true,
      runValidators: true,
    })
    answer = {n:ocs.name,msg:'Успех: СУО изменено'};
    return res.send(JSON.stringify(answer))
    
  } catch (err) {
    console.error(err)
    answer = {redir:'/my_OCSes',msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
  }
  
});
// deleting OCS (only creator can)
router.delete('/deleteOCS/:ids', ensureAuthenticated, async (req, res) => {
  try {
    const p = decrypt(req.params.ids)
    let ocs = await OCS.findById(p[0])
      .populate({ path: "g_roles", select: "_id", populate: { path: "users", select: "_id" } })
      .populate({ path: "projects", populate: { path: "l_roles", select: "_id" } })
      .lean()
    if (!ocs || ocs.creator_id.toString() != req.user._id.toString()) {
      answer = {
        redir:"/my_OCSes",
        msg:'Текущее СУО перестало существовать   или Вы не являетесь ее создателем'
      };
      return res.send(JSON.stringify(answer))
    } 
    let users = [];
    let groleIds = [];
    let lroleIds = [];
    let projectIds = [];
    for (let i = 0; i < ocs.g_roles.length; i++) {
      groleIds.push(ocs.g_roles[i]._id.toString())
      for (let j = 0; j < ocs.g_roles[i].users.length; j++) {
        users.push(ocs.g_roles[i].users[j]._id.toString())
      }
    }
    for (let i = 0; i < ocs.projects.length; i++) {
      projectIds = ocs.projects[i]._id.toString();
      for (let j = 0; j < ocs.projects[i].l_roles.length; j++) {
        lroleIds.push(ocs.projects[i].l_roles[j]._id.toString())
      }
    }
    await User.updateMany(
      { _id: { $in: users } },
      {
        $pull: {
          g_roles: { $in: groleIds },
          l_roles: { $in: lroleIds }
        }
      })
    await Project.deleteMany({ ocsId: p[0] })
    await Role.deleteMany({ ocsId: p[0] }) //deletes both l and g roles
    await OCS.deleteOne({ _id: p[0] })
    answer = {msg:'Успех: СУО удалено'};
    return res.send(JSON.stringify(answer))
  } 
  catch (err) {
    console.error(err)
    answer = {redir:"/my_OCSes",msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
  }
})
// leaving OCS
router.delete('/leaveOCS/:ids', ensureAuthenticated, async (req, res) => {
  //check if user is in this ocs at all and if user was last one in OCS-delete it
  const p = decrypt(req.params.ids)
  let ocs = await OCS.findById(p[0])
      .populate({ path: "g_roles", select: "_id", populate: { path: "users", select: "_id" } })
      .populate({ path: "projects", populate: { path: "l_roles", select: "_id" } })
      .lean()
  if (!ocs) {
    answer = {
      redir:"/my_OCSes",
      msg:'Текущее СУО перестало существовать   '
    };
    return res.send(JSON.stringify(answer))
  }
  let k = false;
  for (let i = 0; i < ocs.g_roles.length; i++) {
    for (let j = 0; j < ocs.g_roles[i].users.length; j++) {
      if (ocs.g_roles[i].users[j]._id.toString() == req.user._id.toString()) {
        k = true;
      }
      else {
        k = false;
      }
    }
  }
  if (k) {//current user is last one of OCS.so init deleteOCS
  try {
    let users = [];
    let groleIds = [];
    let lroleIds = [];
    let projectIds = [];
    for (let i = 0; i < ocs.g_roles.length; i++) {
      groleIds.push(ocs.g_roles[i]._id.toString())
      for (let j = 0; j < ocs.g_roles[i].users.length; j++) {
        users.push(ocs.g_roles[i].users[j]._id.toString())
      }
    }
    for (let i = 0; i < ocs.projects.length; i++) {
      projectIds = ocs.projects[i]._id.toString();
      for (let j = 0; j < ocs.projects[i].l_roles.length; j++) {
        lroleIds.push(ocs.projects[i].l_roles[j]._id.toString())
      }
    }
    await User.updateMany(
      { _id: { $in: users } },
      {
        $pull: {
          g_roles: { $in: groleIds },
          l_roles: { $in: lroleIds }
        }
      })
    await Project.deleteMany({ ocsId: p[0] })
    await Role.deleteMany({ ocsId: p[0] }) //deletes both l and g roles
    await OCS.deleteOne({ _id: p[0] })
    answer = {msg:'Успех: СУО удалено'};
    return res.send(JSON.stringify(answer))
    } catch (err) {
      console.error(err)
      answer = {redir:"/my_OCSes",msg:'Ошибка'};
      return res.send(JSON.stringify(answer))
    }
  }
  else {
    try {
    let user = await User.findById(req.user._id).populate("g_roles").populate("l_roles");
    if (!user ){
      answer = {redir:"/login",msg:'Вашего аккаунта нету.Перезайдите'};
      req.logout();
      return res.send(JSON.stringify(answer))
    }
    if (await Role.findOne({ ocsId: p[0], users: user._id })) {
      for (let i = 0; i < user.g_roles.length; i++) {
        if (user.g_roles[i].ocsId == p[0]) {
          user.g_roles.pull(user.g_roles[i]);
        }
      }
      for (let i = 0; i < user.l_roles.length; i++) {
        if (user.l_roles[i].ocsId == p[0]) {
          user.l_roles.pull(user.l_roles[i]);
        }
      }
      await user.save().catch(err => console.log(err));
      await Role.updateMany({ ocsId: p[0] }, {
        $pull: {
          users: user._id
        }
      })
      answer = {msg:'Успех: Пользователь убран из СУО'};
      res.send(JSON.stringify(answer))
    }
    else {
      answer = {redir:"/my_OCSes",msg:'Пользователя нету в данной СУО'};
      return res.send(JSON.stringify(answer))
    }
    } catch (err) {
      console.error(err)
      answer = {redir:"/my_OCSes",msg:'Ошибка'};
      return res.send(JSON.stringify(answer))
    }
  }
})


/**
* 
* 
* role management
* 
* 
*/


//edit, create and delete Role
router.post('/createRole/10/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  const { name, access } = req.body;
  let errors = [];
  if (!name || !access) {
    errors.push( 'Заполните все поля' );
  }
  if (name.length < 3 || name.length > 30) {
    errors.push( 'Название должно быть не меньше 6 и не больше 35 символов' );
  }
  if (!name.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push( 'Название должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела' );
  }
  await Role.findOne({ ocsId: p[0], name: name }).then(r => {
    if (r) {
      errors.push( 'Роль с таким именем уже существует' );
    }
  });
  if (errors.length > 0) {
    answer = {msg:errors};
    return res.send(JSON.stringify(answer))
  } 
  try {
    let ocs = await OCS.findById(p[0]).populate("g_roles")
    if (!ocs) {
      answer = {
        redir:"/my_OCSes",
        msg:'Текущее СУО перестало существовать  '
      };
      return res.send(JSON.stringify(answer))
    }
    const role = new Role({
      name: name,
      ocsId: p[0],
    });
    role.access[0] = true;
    for (let i = 1; i <= 17; i++) {
      if (access.includes(i.toString())) {
        role.access[i] = true
      }
      else {
        role.access[i] = false
      }
    }
    if (role.access[7] == true || role.access[8] == true) role.access[5] = true //if you can edit/delete users you must be able to view them
    if (role.access[11] == true || role.access[12] == true) role.access[9] = true //if you can edit/delete roles you must be able to view them          
    await role.save().catch(err => console.log(err));
    ocs.g_roles.push(role);
    await ocs.save().catch(err => console.log(err));
    answer = {
      obj:{
        id:encrypt (p[0]+' '+role._id.toString()),
        n:role.name,
        acc:role.access
      },
      msg:'Успех: Роль создана'
    };
    return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
  }
});
router.put('/editRole/11/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  const { name, access } = req.body;
  let errors = [];
  o_n=await Role.findById(p[1])
    if (!o_n){
      answer = {
        redir:'/ocs/view/0/' + encrypt(p[0]),
        msg:'Роль не существует или была удалена'
      };
     return res.send(JSON.stringify(answer))
    }
    if (o_n.name=="admin"|| o_n.name=="canEnter"||o_n.name=="banned"){
      answer = {
        redir:'/ocs/view/0/' + encrypt(p[0]),
        msg:'Эта роль базовая и ее нельзя изменить'
      };
     return res.send(JSON.stringify(answer))
    }
   if (!name || !access) {
    errors.push( 'Заполните все поля' );
  }
  if (name.length < 3 || name.length > 30) {
    errors.push( 'Название должно быть не меньше 3 и не больше 30 символов' );
  }
  if (!name.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push( 'Название должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела');
  }

  if (errors.length > 0) {
    answer = {msg:errors};
   return res.send(JSON.stringify(answer))
  } 
  try {
    const role = new Role({
      name: name,
    });
    role.access[0] = true;
    for (let i = 1; i <= 17; i++) {
      if (access.includes(i.toString())) {
        role.access[i] = true
      }
      else {
        role.access[i] = false
      }
    }
    if (role.access[7] == true || role.access[8] == true) role.access[5] = true //if you can edit/delete users you must be able to view them
    if (role.access[11] == true || role.access[12] == true) role.access[9] = true //if you can edit/delete roles you must be able to view them        

    await Role.findByIdAndUpdate(p[1], { $set: { name: role.name, access: role.access } }, {
      new: true,
      runValidators: true,
    })
    answer = {
      obj:{
        id:req.params.ids,
        o_n:o_n.name,
        n:role.name,
        acc:role.access
      },
      msg:'Успех: Роль изменена'
    };
   return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
  }
});
router.delete('/deleteRole/12/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  try {
    const p = decrypt(req.params.ids)
    o_n=await Role.findById(p[1])
    if (!o_n){
      answer = {
        redir:'/ocs/view/0/' + encrypt(p[0]),
        msg:'Роль не существует или была удалена'
      };
     return res.send(JSON.stringify(answer))
    }
    if (o_n.name=="admin"|| o_n.name=="canEnter"||o_n.name=="banned"){
      answer = {
        redir:'/ocs/view/0/' + encrypt(p[0]),
        msg:'Эта роль базовая и ее нельзя удалить'
      };
     return res.send(JSON.stringify(answer))
    }
    let users = await User.find({ g_roles: p[1] }).select("_id").lean();
    if (users.length > 0) {
      let rol = await Role.findOne({ ocsId: p[0], name: "canEnter" })
      for (let i in users) {
        rol.users.push(users[i]._id.toString());
      }
      await rol.save().catch(err => console.log(err))
      await User.updateMany({ g_roles: p[1] }, {
        $push: {
          g_roles: rol._id
        }
      })
      await User.updateMany({ g_roles: p[1] }, {
        $pull: {
          g_roles: new ObjectId(p[1])
        }
      })
    }
    await OCS.findByIdAndUpdate(p[0], {
      $pull: {
        g_roles: new ObjectId(p[1])
      }
    })
    
    await Role.deleteOne({ _id: p[1] })
    answer = {
      obj:{
        k:1,
        id:req.params.ids
      },      
      msg:'Успех: Роль удалена из СУО'
    };
   return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
   return res.send(JSON.stringify(answer))
  }
})


/**
* 
* 
* user management
* 
* 
*/
//view user
//create user and add to OCS / w
router.post('/createUser/6/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids);
  const { name, email, password, password2, grole } = req.body;
  let errors = [];
  if (!name || !email || !password || !password2 || !grole) {
    errors.push( 'Заполните все поля' );
  }
  if (name.length < 6 || name.length > 35) {
    errors.push( 'Обращение к пользователю должно быть не меньше 6 и не больше 35 символов' );
  }
  if (!name.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push( 'Обращение к пользователю должно быть только из букв латиницы,  кириллицы, цифр, нижнего подчеркивания или пробела' );
  }
  if (password != password2) {
    errors.push( 'Пароли не совпадают' );
  }
  if (!email.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)) {
    errors.push( 'Некорректная электронная почта' );
  }

  if (!password.match(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)) {
    errors.push( 'Пароль от 8 символов,1 буквы,1 цифры и 1 спецсимвола : @$!%*#?&' );
  }
  let uu = await User.findOne({ name: name });
  if (uu) {
    errors.push({ msg: 'Пользователь с таким ником уже существует' });
  }
  await User.findOne({ email: email }).then(user => {
    if (user) {
      errors.push( 'Почта уже существует' );
    }
  });
  if (errors.length > 0) {
    answer = {msg:errors};
   return res.send(JSON.stringify(answer))
  }
  try {
    let role = await Role.findById(decrypt(grole)).populate("users")
    if (!role){
      answer = {
        redir:'/ocs/view/0/' + encrypt(p[0]),
        msg:'Роль не существует или была удалена'
      };
     return res.send(JSON.stringify(answer))
    }
    const user = new User({
      name: name,
      email,
      password,
    });
    const hash = bcrypt.hashSync(user.password, bcrypt.genSaltSync(10));
    user.password = hash;
    user.g_roles.push(role);
    await user.save().catch(err => console.log(err));
    role.users.push(user);
    await role.save().catch(err => console.log(err));
    answer = {
      obj:{
        id:encrypt (p[0]+' '+user._id.toString()),
        n:user.name,
        r:role.name,
        nr_id:grole
      },
      msg:'Успех: Пользователь создан'
    };
    return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
   return res.send(JSON.stringify(answer))
  }
});
router.post('/addUserIn/6/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids);
  const { email, grole } = req.body;
  let errors = [];
  if (!email || !grole) {
    errors.push('Заполните все поля' );
  }
  if (!email.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)) {
    errors.push('Некорректная электронная почта');
  }
  let user = await User.findOne({ email: email }).populate("g_roles")
  if (!user) {
    errors.push( 'Такой пользователь не зарегестрирован');
  }
  let k = false;
  let roles = await Role.find({ ocsId: p[0] }).populate({ path: "users", select: "email" })
  for (let i = 0; i < roles.length; i++) {
    for (let j = 0; j < roles[i].users.length; j++) {
      if (roles[i].users[j].email == email) {
        errors.push( 'Пользователь уже есть в СУО' );
        k = true;
        break;
      }
    }
    if (k) {
      break;
    }
  }
  if (errors.length > 0) {
    answer = {msg:errors};
   return res.send(JSON.stringify(answer))
  }
  try {
    
    let role = await Role.findById( decrypt(grole) ).populate("users")
    if (!role){
      answer = {
        redir:'/ocs/view/0/' + encrypt(p[0]),
        msg:'Роль не существует или была удалена'
      };
      return res.send(JSON.stringify(answer))
    }
    user.g_roles.push(role);
    await user.save().catch(err => console.log(err));
    role.users.push(user);
    await role.save().catch(err => console.log(err));
    answer = {
      obj:{
        id:encrypt(p[0]+' '+user._id.toString()),
        n:user.name,
        r:role.name,
        nr_id:grole
      },
      msg:'Успех: Пользователь добавлен в СУО'
    };
   return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
   return res.send(JSON.stringify(answer))
  }
});
//edit user roles 
router.get('/editUserRoles/7/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  let user = await User.findById( p[1] ).populate("g_roles").populate("l_roles")
  if (!user) {
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'ОШИБКА:Пользователя не существует'
    };
   return res.send(JSON.stringify(answer))
  }
  if (user._id.toString() == req.user._id.toString()) {
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'ОШИБКА:Себе, любимому, нельзя менять роль'
    };
   return res.send(JSON.stringify(answer)) 
  }  
  if (await OCS.findOne({_id: p[0],creator_id: user._id.toString()})) {
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'ОШИБКА:Создателю нельзя менять роль'
    };
   return res.send(JSON.stringify(answer))  
  }
  let old_lroles = [];
  for (let i in user.l_roles) {
    if (user.l_roles[i].ocsId == p[0]) {
      old_lroles.push(user.l_roles[i]._id.toString())
    }
  }
  //only projects where user already is
  let projects;
  if (old_lroles.length > 0) {
    projects = await Project.find({ ocsId: p[0], l_roles: { $in: old_lroles } }).select("_id name")
      .populate("l_roles","_id name")
  }
  for (let x in old_lroles){
    old_lroles[x] = encrypt(p[0]+' '+old_lroles[x])
  }
  //console.log(old_lroles)
  let all_p=[];    
  for (let x in projects){
    let pp={
      n:projects[x].name,
      lroles:[],
      lr_names:[]
    }
    for (let i in projects[x].l_roles){
      enc_id=encrypt(p[0]+' '+projects[x].l_roles[i]._id.toString());
      for (let j in old_lroles){
          if (old_lroles[j]==enc_id){
            t=old_lroles[x]
            old_lroles[x]=old_lroles[j]
            old_lroles[j]=t
            break
          }
      }
      pp.lroles.push(enc_id)
      pp.lr_names.push(projects[x].l_roles[i].name);
    }
    all_p.push(pp)
  }
  //console.log(all_p)
  return res.send(JSON.stringify( {
    all_p: all_p,
    old_lroles: old_lroles
  }));
});
router.put('/editUserRoles/7/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  const { grole, old_grole } = req.body;
  let user = await User.findById(p[1]).populate("g_roles").populate("l_roles")
  if (!user ){
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'Этого пользователя больше нет'
    };
    return res.send(JSON.stringify(answer))
  }  
  let role = await Role.findById(decrypt(grole)).populate("users")
  if (!role){
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'Глобальная Роль не существует или была удалена'
    };
    return res.send(JSON.stringify(answer))
  }
  try {
  if (grole!=old_grole){
    let check_grole = false
  let oldrole = await Role.findById(decrypt(old_grole)).populate("users")
  for (let j in oldrole.users) {
    if (oldrole.users[j]._id == p[1]) {
      check_grole = true
      break;
    }
  }    
  if (!check_grole) {
  answer = {
    redir:'/ocs/view/0/' + encrypt(p[0]),
    msg:"Прошлая глобальная роль:" + oldrole.name + " уже не содержит этого пользователя"
  };
  return res.send(JSON.stringify(answer))
  }  
    user.g_roles.pull(oldrole)
    oldrole.users.pull(user);
    await oldrole.save().catch(err => console.log(err));
    user.g_roles.push(role);
  }  
  let new_lroles;    
  if (req.body.no_lr !== "1" ) {
        if (req.body.old_lroles.constructor === Array 
          && req.body.new_lroles.constructor === Array) {
          new_lroles = req.body.new_lroles
          let old_lroles = req.body.old_lroles
          //console.log(req.body.new_lroles, req.body.old_lroles)
          if (old_lroles.length != new_lroles.length) {
            answer = {
              redir:'/ocs/view/0/' + encrypt(p[0]),
              msg:'ОШИБКА:Количество новых ролей не совпадает с кол-вом старых. Магия какая-то'
            };
          return res.send(JSON.stringify(answer))
          }
          //decrypt
          for (let x in old_lroles) {
            old_lroles[x] = decrypt(old_lroles[x])
            new_lroles[x] = decrypt(new_lroles[x])
          }
          let check_lrole = false
          for (let x in old_lroles) {
            let oldrol = await Role.findById(old_lroles[x]).populate("users")
            for (let j in oldrol.users) {
              if (oldrol.users[j]._id == p[1]) {
                check_lrole = true
                break;
              }
            }
            if (!check_lrole) {
              answer = {
                redir:'/ocs/view/0/' + encrypt(p[0]),
                msg:"Прошлая локальная роль:" + oldrol.name + 
                " уже не содержит этого пользователя"
              };
            return res.send(JSON.stringify(answer))
            }
            check_lrole = false
          }
          for (let i in new_lroles) {
            if (old_lroles[i] == new_lroles[i]) {
              continue;
            }
            else {
              let old_lrole = await Role.findById(old_lroles[i]).populate("users")
              let new_lrole = await Role.findById(new_lroles[i]).populate("users")
              user.l_roles.pull(old_lrole)
              old_lrole.users.pull(user);
              user.l_roles.push(new_lrole);
              new_lrole.users.push(user);
              await old_lrole.save().catch(err => console.log(err));
              await new_lrole.save().catch(err => console.log(err));
            }
          }
      }
      else {
        new_lroles = req.body.new_lroles
        let old_lroles = req.body.old_lroles
        //decrypt 
        old_lroles = decrypt(old_lroles)
        new_lroles = decrypt(new_lroles)        
        let check_lrole = false
        let oldrol = await Role.findById(old_lroles).populate("users")
        for (let j in oldrol.users) {
          if (oldrol.users[j]._id == p[1]) {
            check_lrole = true
            break;
          }
        }
        if (!check_lrole) {
          answer = {
            redir:'/ocs/view/0/' + encrypt(p[0]),
            msg:"Прошлая локальная роль:" + oldrol.name + " уже не содержит этого пользователя"
          };
        return res.send(JSON.stringify(answer))
        }        
        let old_lrole = await Role.findById(old_lroles).populate("users")
        let new_lrole = await Role.findById(new_lroles).populate("users")
        user.l_roles.pull(old_lrole)
        old_lrole.users.pull(user);
        user.l_roles.push(new_lrole);
        new_lrole.users.push(user);
        await old_lrole.save().catch(err => console.log(err));
        await new_lrole.save().catch(err => console.log(err));
      }
  }
    if (req.body.no_lr !== "1" || grole!=old_grole){
      await user.save().catch(err => console.log(err));
      if (grole!=old_grole){
      role.users.push(user);
      await role.save().catch(err => console.log(err));
      }
      
      if (new_lroles)
      {
        ps=new_lroles.length
      }
      else {
        ps=0
      }
      answer = {
        obj:{
          id:req.params.ids,
          r:role.name,
          nr_id:grole,
          or_id:old_grole,
          ps:ps
        },
        msg:'Успех: Изменена роль пользователя'
      };
      return res.send(JSON.stringify(answer))
    }
    else {
      answer = {
        msg:['Вы ничего не выбрали']
     };
      return res.send(JSON.stringify(answer))
    }
    
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
  }
 
  
});
//remove user out of OCS / w
router.delete('/removeUser/8/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
try {
  const p = decrypt(req.params.ids);
  let user = await User.findById(p[1]).populate("g_roles").populate("l_roles");
  if (!user) {
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'Пользователя не существует.'
    };
    return res.send(JSON.stringify(answer))
  }
  if (user._id.toString() == req.user._id.toString()) {
    answer = {          
      msg:'Чтобы удалить себя, воспользуетесь опцией Покинуть СУО при выборе СУО'
    };
    return res.send(JSON.stringify(answer))
  }
  if (await Role.findOne({ ocsId: p[0], users: user._id })) {
    for (let i = 0; i < user.g_roles.length; i++) {
      if (user.g_roles[i].ocsId == p[0]) {
        user.g_roles.pull(user.g_roles[i]);
      }
    }
    for (let i = 0; i < user.l_roles.length; i++) {
      if (user.l_roles[i].ocsId == p[0]) {
        user.l_roles.pull(user.l_roles[i]);
      }
    }
    await user.save().catch(err => console.log(err));
    await Role.updateMany({ ocsId: p[0] }, {
      $pull: {
        users: user._id
      }
    })
    answer = {
      obj:{
        id:req.params.ids
      },
      msg:'Успех: Пользователь убран из СУО'
    };
    return res.send(JSON.stringify(answer))
  }
  else {
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'Пользователя/его роли больше нету в данной СУО.'
    };
    return res.send(JSON.stringify(answer))
  }
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
  }
})
/**
 * 
 * 
 * projects management
 * 
 * 
 */

//create / w
router.post('/createProject/2/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const { cP_n, cP_d } = req.body;
  const p = decrypt(req.params.ids);
  let errors = [];
  if (!cP_n) {
    errors.push('Заполните название' );
  }
  if (cP_n.length < 3 || cP_n.length > 60) {
    errors.push('Название должно быть не меньше 3 и не больше 30 символов' );
  }
  if (!cP_n.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push('Название должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела' );
  }
  if (cP_d && (!cP_d.match(/^[a-zA-Zа-яА-Я0-9ё\.,:;\?!_ ]+$/iu) || cP_d.length > 99)) {
    errors.push('Описание к проекту должно быть длинной меньше 100 символов и только из букв латиницы, кириллицы, цифр, _ , . : ; ! ? или пробела');
  }

  if (errors.length > 0) {
    answer = {msg:errors};
   return res.send(JSON.stringify(answer))
  } 
  try {
    let user = await User.findById(req.user._id).populate("l_roles")
    if (!user) {
      answer = {
        redir:"/login",
        msg:'Вы не существуете.Перезайдите'
      };
      req.logout();
      return res.send(JSON.stringify(answer))
    } 
    else{
      let ocs = await OCS.findById(p[0])
      if (!ocs) {
        answer = {
          redir:"/my_OCSes",
          msg:'Текущее СУО перестало существовать '
        };
        return res.send(JSON.stringify(answer))
      }
      else{
        const project = new Project({
          ocsId: p[0],
          name: cP_n,
          desc: cP_d
        });
        const role = new Role({
          name: "admin",
          ocsId: p[0],
          projectId: project._id,
          access: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        });
        const roleBanned = new Role({
          name: "banned",
          ocsId: p[0],
          projectId: project._id,
          access: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        })
        const roleCanEnter = new Role({
          name: "canEnter",
          ocsId: p[0],
          projectId: project._id,
          access: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] //view==can be in project so [0] and [1] are true 
        })
  
        user.l_roles.push(role);
        role.users.push(user);
        project.l_roles.push(role);
        project.l_roles.push(roleBanned);
        project.l_roles.push(roleCanEnter);
        ocs.projects.push(project);
        await ocs.save().catch(err => console.log(err));
        await user.save().catch(err => console.log(err));
        await role.save().catch(err => console.log(err));
        await roleBanned.save().catch(err => console.log(err));
        await roleCanEnter.save().catch(err => console.log(err));
        await project.save().catch(err => console.log(err));
        answer = {
          obj:{
            id:encrypt (ocs._id.toString()+' '+project._id.toString()),
            n:project.name,
            d:project.desc,
          },
          msg:'Успех: Проект создан'};
        return res.send(JSON.stringify(answer))
      }
    }
  } catch (err) {
    console.log(err);     
    answer = {
      redir:'/ocs/view/0/' + encrypt(p[0]),
      msg:'Не получилось создать проект'
    };
    return res.send(JSON.stringify(answer))
  }
});


module.exports = router;
