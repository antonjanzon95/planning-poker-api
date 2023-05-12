var express = require('express');
var router = express.Router();
const SessionModel = require("../models/SessionModel");

// *************** Get all saved sessions from DB ***************
router.get('/', async function(req,res,next) {
    try {
        const sessions = await SessionModel.find();
        res.send(sessions);
    } catch (error) {
        console.log('Något gick fel.', error)
    }
});

module.exports = router;