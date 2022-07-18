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
 * projects management
 * ocsId=p[0]
 * projectId=p[1]
 * elseId=p[2]
 */

//view selected project / w
router.get('/view/1/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  let ocs = await OCS.findOne({ _id: p[0], projects: p[1] })
    .populate({ path: "g_roles", populate: { path: "users", select: "_id" } })
  if (!ocs) {
    req.flash('error_msg', "СУО не существует");
    res.redirect('/my_OCSes');
  }
  else {
    let project = await Project.findById(p[1])
      .populate({ path: "l_roles", populate: { path: "users" } })
    if (!project) {
      req.flash('error_msg', "Проект не существует");
      res.redirect('/ocs/view/0/' + encrypt(p[0]));
    }
    else {
      let admins = [];
      for (let i = 0; i < ocs.g_roles.length; i++) {
        //remembering which users cant de changed or edited
        if (ocs.g_roles[i].name = "admin") {
          for (let j = 0; j < ocs.g_roles[i].users.length; j++) {
            admins.push(ocs.g_roles[i].users[j]._id.toString())
          }
          break;
        }
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
      let lr = req.user.l_roles;
      req.user.l_roles = [];
      for (let i = 0; i < lr.length; i++) {
        if (lr[i].ocsId == p[0] && lr[i].projectId == p[1]) {
          req.user.l_roles.push(lr[i]);
        }
      }

      res.render('Project', {
        ids: req.params.ids,
        encrypt: encrypt,
        user: req.user,
        project: project,
        creator: ocs.creator_id,
        admins: admins
      })
    }
  }
});
//edit / w
router.put('/editProject/3/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  const { pName, pDesc } = req.body;
  let errors = [];
  if (!pName) {
    errors.push('Заполните название')
  }
  if (!pName.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push('Название должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела')
  }
  if (pDesc && (!pDesc.match(/^[a-zA-Zа-яА-Я0-9ё\.,:;\?!_ ]+$/iu) || pDesc.length > 100)) {
    errors.push('Описание к проекту должно быть длинной меньше 100 символов и только из букв латиницы, кириллицы, цифр, _ , . : ; ! ? или пробела')
  }
  if (pName.length < 3 || pName.length > 60) {
    errors.push('Название должно быть не меньше 3 и не больше 30 символов')
  }
  if (errors.length > 0) {
    answer = {msg:errors};
    return res.send(JSON.stringify(answer))
  } else {
    try {
      let project = await Project.findById(p[1])
      if (!project) {
        answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Проект не существует.'};
        return res.send(JSON.stringify(answer))
      } else {
        await Project.findByIdAndUpdate(p[1], { $set: { name: pName, desc: pDesc } }, {
          new: true,
          runValidators: true,
        })
        answer = {
          obj:{
            id:req.params.ids,
            n:pName,
            d:pDesc
          },
          msg:'Успех: Проект изменен'
        };
        return res.send(JSON.stringify(answer))
      }
    } catch (err) {
      console.error(err)
      answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
      return res.send(JSON.stringify(answer))
    }
  }
});
//delete / w
router.delete('/deleteProject/4/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  try {
    const p = decrypt(req.params.ids)
    let project = await Project.findById(p[1])
      .populate({ path: "l_roles", populate: { path: "users", select: "_id" } })
      .lean()
    if (!project) {
      answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Проект не существует.'};
      return res.send(JSON.stringify(answer))
    }
    let users = [];
    let lroleIds = [];
    for (let i = 0; i < project.l_roles.length; i++) {
      lroleIds.push(project.l_roles[i]._id.toString())
      for (let j = 0; j < project.l_roles[i].users.length; j++) {
        users.push(project.l_roles[i].users[j]._id.toString())
      }
    }
    await User.updateMany(
      { _id: { $in: users } },
      {
        $pull: {
          l_roles: { $in: lroleIds }
        }
      })
    await Role.deleteMany({ projectId: p[1] }) //deletes l_roles
    await OCS.findByIdAndUpdate(p[0], {
      $pull: {
        projects: project._id
      }
    })
    await Project.deleteOne({ _id: p[1] })
    answer = {
      obj:{
        id:req.params.ids
      },
      msg:'Успех: Проект удален'
    };
    return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
  }
})
//leaving Project / w
router.delete('/leaveProject/:ids', ensureAuthenticated, async (req, res) => {
  try {
    const p = decrypt(req.params.ids)
    let user = await User.findById(req.user._id).populate("l_roles");
    if (!user) {
      req.logout();
      answer = {redir:'/login',msg:'Вы не существуете. Перезайдите'};
      return res.send(JSON.stringify(answer))
    }
    let project = await Project.findById(p[1])
    if (!project) {
      answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Проект не существует.'};
      return res.send(JSON.stringify(answer))
    }
    for (let i = 0; i < user.l_roles.length; i++) {
      if (user.l_roles[i].ocsId == p[0] && user.l_roles[i].projectId == p[1]) {
        await Role.findByIdAndUpdate(user.l_roles[i]._id, {
          $pull: {
            users: user._id
          }
        })
        user.l_roles.pull(user.l_roles[i]);
        break;
      }
    }
    await user.save().catch(err => console.log(err));
    answer = {      
      obj:{
        id:req.params.ids
      },    
      msg:'Успех: Вы вышли из проекта'
    };
    return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {redir: '/ocs/view/0/' + encrypt(p[0]),msg:'Ошибка'};
    return res.send(JSON.stringify(answer))
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
  await Role.findOne({ ocsId: p[0], projectId: p[1], name: name }).then(r => {
    if (r) {
      errors.push( 'Роль с таким именем уже существует в проекте' );
    }
  });
  if (errors.length > 0) {
    answer = {msg:errors};
   return res.send(JSON.stringify(answer))
  }
    try {
      let project = await Project.findById(p[1]).populate("l_roles")
      if (!project) {
        answer = {redir:'/ocs/view/0/' + encrypt(p[0]),msg:'Проект не существует.'};
        return res.send(JSON.stringify(answer))
      }
      const role = new Role({
        name: name,
        ocsId: p[0],
        projectId: p[1]
      });
      role.access[0] = true;
      role.access[1] = true; //view==can be in project
      //role.access[2]=false; unused and for safety reasons should be false (no need in assigning value)
      for (let i = 3; i <= 17; i++) {
        if (access.includes(i.toString())) {
          role.access[i] = true
        }
        else {
          role.access[i] = false
        }
      }
      if (role.access[7] == true || role.access[8] == true) role.access[5] = true //if you can edit/delete all users you must be able to view them
      if (role.access[11] == true || role.access[12] == true) role.access[9] = true //if you can edit/delete all roles you must be able to view them

      await role.save().catch(err => console.log(err));
      project.l_roles.push(role);
      await project.save().catch(err => console.log(err));
      answer = {
        obj:{
          id:encrypt (p[0]+' ' + p[1]+' '+role._id.toString()),
          n:role.name,
          acc:role.access
        },
        msg:'Успех: Роль создана'
      };
      return res.send(JSON.stringify(answer))
    } catch (err) {
      console.error(err)
      answer = {
        redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
        msg:'Ошибка'
      };
      return res.send(JSON.stringify(answer))
    }
  
});
router.put('/editRole/11/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  const { name, access } = req.body;
  let errors = [];
  o_n=await Role.findById(p[2])
  if (!o_n) {
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'Роль не существует или была удалена'
    };
   return res.send(JSON.stringify(answer))
  }
  if (o_n.name=="admin"|| o_n.name=="canEnter"||o_n.name=="banned"){
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'Эта роль базовая и ее нельзя изменить'
    };
   return res.send(JSON.stringify(answer))
  }
  if (!name || !access) {
    errors.push( 'Заполните все поля' );
  }
  if (name.length < 3 || name.length > 30) {
    errors.push( 'Название должно быть не меньше 6 и не больше 35 символов' );
  }
  if (!name.match(/^[a-zA-Zа-яА-Я0-9ё_ ]+$/iu)) {
    errors.push( 'Название должно быть только из букв латиницы, кириллицы, цифр, нижнего подчеркивания или пробела' );
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
        role.access[1] = true; //view==can be in project
        //role.access[2] is null and unused at the moment
        for (let i = 3; i <= 17; i++) {
          if (access.includes(i.toString())) {
            role.access[i] = true
          }
          else {
            role.access[i] = false
          }
        }
        if (role.access[7] == true || role.access[8] == true) role.access[5] = true //if you can edit/delete all users you must be able to view them
        if (role.access[11] == true || role.access[12] == true) role.access[9] = true //if you can edit/delete all roles you must be able to view them

        await Role.findByIdAndUpdate(p[2], { $set: { name: role.name, access: role.access } }, {
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
        answer = {
          redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
          msg:'Ошибка'
        };
        return res.send(JSON.stringify(answer))
      }
});
router.delete('/deleteRole/12/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  try {
    const p = decrypt(req.params.ids)
    o_n=await Role.findById(p[2])
    if (!o_n){
      answer = {
        redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
        msg:'Роль не существует или была удалена'
      };
     return res.send(JSON.stringify(answer))
    }
    if (o_n.name=="admin"|| o_n.name=="canEnter"||o_n.name=="banned"){
      answer = {
        redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
        msg:'Эта роль базовая и ее нельзя удалить'
      };
     return res.send(JSON.stringify(answer))
    }
    let users = await User.find({ l_roles: p[2] }).select("_id");
    if (users.length > 0) {
      let rol = await Role.findOne({ projectId: p[1], name: "canEnter" })
      for (let i in users) {
        rol.users.push(users[i]._id.toString());
      }
      await rol.save().catch(err => console.log(err))
      await User.updateMany({ l_roles: p[2] }, {
        $push: {
          l_roles: rol._id
        }
      })
      await User.updateMany({ l_roles: p[2] }, {
        $pull: {
          l_roles: new ObjectId(p[2])
        }
      })
    }
    await Project.findByIdAndUpdate(p[1], {
      $pull: {
        l_roles: new ObjectId(p[2])
      }
    })
    await Role.deleteOne({ _id: p[2] })
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
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'Ошибка'
    };
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
//add user (that is already registered) to project
router.post('/addUserIn/6/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  const {email, lrole } = req.body;
  let errors = [];
  if (!email || !lrole) {
    errors.push( 'Заполните все поля' );
  }
  let user = await User.findOne({ email: email }).populate("l_roles").populate("g_roles")
  if (!user) {
    errors.push( 'Такой пользователь не зарегестрирован' );
  }
  let k = false;
  let roles = await Role.find({ projectId: p[1] }).populate({ path: "users", select: "email" })
  for (let i = 0; i < roles.length; i++) {
    for (let j = 0; j < roles[i].users.length; j++) {
      if (roles[i].users[j].email == email) {
        errors.push( 'Пользователь уже есть в проекте' );
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
      let role = await Role.findById(decrypt(lrole)).populate("users")
      if (!role){
        answer = {
          redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
          msg:'Роль не существует или была удалена'
        };
        return res.send(JSON.stringify(answer))
      }
      user.l_roles.push(role);
      let d = false;
      let groles = await Role.find({ ocsId: p[0], projectId: null }).populate({ path: "users", select: "email" })
      for (let i = 0; i < groles.length; i++) {
        for (let j = 0; j < groles[i].users.length; j++) {
          if (groles[i].users[j].email == email) {
            d = true;//пользователь имеет глобальную роль
            break;
          }
        }
        if (d) {
          break;
        }
      }
      if (!d) {//если нет,помещаю в роль canEnter
        let canEnter = await Role.findOne({ ocsId: p[0], projectId: null, name: "canEnter" })
        user.g_roles.push(canEnter);
        canEnter.users.push(user);
        await canEnter.save().catch(err => console.log(err));
      }
      await user.save().catch(err => console.log(err));
      role.users.push(user);
      await role.save().catch(err => console.log(err));
      answer = {
        obj:{
          id:encrypt(p[0] + ' ' + p[1]+' '+user._id.toString()),
          n:user.name,
          r:role.name,
          nr_id:lrole
        },
        msg:'Успех: Пользователь добавлен в СУО'
      };
     return res.send(JSON.stringify(answer))
    } catch (err) {
      console.error(err)
      answer = {
        redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
        msg:'Ошибка'
      };
      return res.send(JSON.stringify(answer))
    }
});
//edit user role / w
router.put('/editUserRole/7/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  const p = decrypt(req.params.ids)
  let user = await User.findById(p[2]).populate("l_roles")
  if (!user) {
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'ОШИБКА:Пользователя не существует'
    };
   return res.send(JSON.stringify(answer))
  }
  if (p[2] == req.user._id.toString()) {
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'ОШИБКА:Себе, любимому, нельзя менять роль'
    };
   return res.send(JSON.stringify(answer)) 
  }  
  if (await OCS.findOne({_id: p[0],creator_id: user._id.toString()})) {
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'ОШИБКА:Создателю нельзя менять роль'
    };
   return res.send(JSON.stringify(answer))  
  }
  const { lrole, old_lrole } = req.body;
  if (old_lrole==lrole) {
    answer = {msg:['Вы ничего не выбрали']};
   return res.send(JSON.stringify(answer))
  }
  let check_lrole = false;
  let oldrole = await Role.findById(decrypt(old_lrole) ).populate("users")
  if (!oldrole){
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'Прошлая Роль не существует или была удалена'
    };
    return res.send(JSON.stringify(answer))
  }
  for (let j in oldrole.users) {
    if (oldrole.users[j]._id == p[2]) {
      check_lrole = true
      break;
    }
  }
  if (!check_lrole) {
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:"Прошлая локальная  роль:" + oldrole.name + " уже не содержит этого пользователя"
    };
    return res.send(JSON.stringify(answer))
  }
  try {
    let role = await Role.findById(decrypt(lrole)).populate("users")
    if (!role){
      answer = {
        redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
        msg:'Новая Роль не существует или была удалена'
      };
      return res.send(JSON.stringify(answer))
    }
    user.l_roles.pull(oldrole)
    oldrole.users.pull(user);
    await oldrole.save().catch(err => console.log(err));
    user.l_roles.push(role);
    await user.save().catch(err => console.log(err));
    role.users.push(user);
    await role.save().catch(err => console.log(err));
    answer = {
      obj:{
        id:req.params.ids,
        r:role.name,
        nr_id:lrole,
        or_id:old_lrole
      },
      msg:'Успех: Изменена роль пользователя'
    };
    return res.send(JSON.stringify(answer))
  } catch (err) {
    console.error(err)
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'Ошибка'
    };
    return res.send(JSON.stringify(answer))
  }
});
//remove user out of project / w
router.delete('/removeUser/8/:ids', ensureAuthenticated, hasThisAccess, async (req, res) => {
  try {
    const p = decrypt(req.params.ids)
    let user = await User.findById(p[2]).populate("l_roles")
    if (!user) {
      answer = {
        redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
        msg:'ОШИБКА:Пользователя не существует'
      };
    return res.send(JSON.stringify(answer))
    }
    if (user._id.toString() == req.user._id.toString()) {
      answer = {          
        msg:'Чтобы удалить себя, воспользуетесь опцией Покинуть СУО при выборе СУО'
      };
      return res.send(JSON.stringify(answer))
    }
    if (await Role.findOne({ projectId: p[1], users: user._id })) {
    for (let i = 0; i < user.l_roles.length; i++) {
      if (user.l_roles[i].ocsId == p[0] && user.l_roles[i].projectId == p[1]) { 
        await Role.findByIdAndUpdate(user.l_roles[i]._id, {
          $pull: {
            users: user._id
          }
        })
        user.l_roles.pull(user.l_roles[i]);
        break;
      }
    }
    await user.save().catch(err => console.log(err));
    answer = {
      obj:{
        id:req.params.ids
      },
      msg:'Успех: Пользователь убран из проекта'
    };
    return res.send(JSON.stringify(answer))
  }
  else {
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'Пользователя/его роли больше нету в данном проекте.'
    };
    return res.send(JSON.stringify(answer))
  }
  } catch (err) {
    console.error(err)
    answer = {
      redir:'/ocs/project/view/1/' + encrypt(p[0] + ' ' + p[1]),
      msg:'Ошибка'
    };
    return res.send(JSON.stringify(answer))
  }
})


module.exports = router;
