var express = require('express');
var router = express.Router();
const SuperadminModel = require("../models/SuperadminModel");

router.post('/', async function(req,res,next) {
    const {username, password} = req.body;
    console.log("req body =>", req.body);
    try {
        const foundSuperadmin = await SuperadminModel.findOne({username: username});
        console.log("Found superadmin =>", foundSuperadmin);

        if(foundSuperadmin && password === foundSuperadmin.password) {
            console.log("Superadmin är inloggad");
            res.status(200).json({isSuperAdmin: true})
        } else {
            console.log("Användarnamn eller lösenord är fel");
            res.status(401).json({isSuperAdmin: false, message: "Användarnamn eller lösenord är fel"})
        }

    } catch (error) {
        console.log("Något gick fel", error);
    }
})

module.exports = router;