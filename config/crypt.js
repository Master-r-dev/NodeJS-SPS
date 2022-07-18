const crypto = require('crypto');
 //#region secur
const algorithm = 'aes-256-ctr';
const secret = 'OCS_AlexS_vOVH6sdmpNWjRN0aW5hdG9yIGlzIG9mRIqCc7rdxs01lwHzfr3';
const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
const iv = crypto.randomBytes(16);
//#endregion
const encrypt = (text) => {

    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return iv.toString('hex') + '_' + encrypted.toString('hex')
    
};

const decrypt = (hash) => {

    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(hash.split('_')[0], 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.split('_')[1], 'hex')), decipher.final()]);

    return decrpyted.toString().split(" ");
};

module.exports = {
    encrypt,
    decrypt
};