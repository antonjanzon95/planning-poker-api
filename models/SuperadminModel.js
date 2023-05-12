const mongoose = require('mongoose');

const SuperadminSchema = mongoose.Schema({
    username: String,
    password: String
});

module.exports = mongoose.model("Superadmin", SuperadminSchema);