var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;
const ocsSchema=  new Schema({
    name: {
      type: String,
      required: true,
      minlength:3,
      maxlength:60
  },
    creator_id:{
      type: String,
      required: true
  },
    g_roles: [
        {
            type: ObjectId,
            ref: "Role"
        }
    ],
    projects: [
        {
            type: ObjectId,
            ref: "Project"
        }
    ],
});
const OCS = mongoose.model("OCS",ocsSchema);

module.exports = OCS;
