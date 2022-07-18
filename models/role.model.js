var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;
const roleSchema=  new Schema({
    name:{
      type: String,
      required: true,
      minlength:3,
      maxlength:50
      },
    ocsId:{
      type: String,
      required: true,
      },
    projectId:  String, 
    access:{
      type: [Boolean],
      required: true,
      },     
    users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ], 
  });
const Role = mongoose.model("Role",roleSchema);

module.exports = Role;

/*индекс массива и какой дает доступ
   //ocs.g_roles[i] (полный доступ) или ocs.project[projectId].l_roles[i] (локальный) где i равен
   //0 access_to_be_in_this_ocs(in_this_project_{name}) /
   //1 доступ к просмотру проектов(project_{name})   
   //2 доступ к добавлению проектов
   //3 доступ к изменению проектов(project_{name})
   //4 доступ к удалению проектов(project_{name})
   //5 доступ к просмотру пользователей(in_project_{name})
   //6 доступ к добавлению пользователей(in_project_{name}/here its adding from only users already in ocs)
   //7 access_to_edit_users(in_project_{name}/user has only email and password,this function has little use...but sure)
   //8 доступ к удалению пользователей(in_project_{name}/removes from the project(cant affect g_roles/just exclude them from list))
   //9 доступ к просмотру ролей(in_project_{name})
   //10 доступ к добавлению ролей(in_project_{name})
   //11 доступ к изменению ролей(in_project_{name}/edits only local role(can only give more access to g_roles(cant be blocked and g_roles.access field that are true — not editable)))
   //12 доступ к удалению ролей(in_project_{name}/removes from the project(cant affect g_roles/just exclude them from list))
    */
   