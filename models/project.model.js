var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;
const projectSchema=  new Schema({
  ocsId:String,
  name: {
      type: String,
      required: true,
      minlength:3,
      maxlength:60
  },
  desc: {
    type: String,
    maxlength:100,
  },
  l_roles: [
      {
          type: ObjectId,
          ref: "Role"
      }
    ]
});
const Project = mongoose.model("Project",projectSchema);

module.exports = Project;
