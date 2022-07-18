//#region mongodb
//если Atlas dbPassword = 'mongodb+srv://YOUR_USERNAME_HERE:'+ encodeURIComponent('YOUR_PASSWORD_HERE') + '@CLUSTER_NAME_HERE.mongodb.net/test?retryWrites=true';
dbPassword = 'mongodb://localhost:27017/ocs_db?readPreference=primary&appname=MongoDB%20Compass&directConnection=true&ssl=false'
module.exports = {
    mongoURI: dbPassword ,
    secret: "OCS_AlexS_VGhlIHByb2NyYXN0aW5hdG9yIGlzIG9mdGVuIHJlbWFya"
};
//#endregion