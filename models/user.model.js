var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;

const userSchema = new Schema({
    name: {
      type: String,
      required: true,
      minlength:6,
      maxlength:35
    },
    email: {
      type: String,
      required: true,
      minlength:5,
      maxlength:40,
  },
    password: {
      type: String,
      required: true,
      minlength:8,
  },
    g_roles: [
        {
            type: ObjectId,
            ref: "Role"
        }
    ],
    l_roles: [
      {
          type: ObjectId,
          ref: "Role"
      }
    ]
});

const User = mongoose.model("User",userSchema);



module.exports = User;
