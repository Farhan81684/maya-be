const express = require('express');
const router = express.Router();
const conversionRatesController = require('../controllers/conversions');
const { VerifyToken, ExportCSV } = require('../middlewares');

// POST, GET all, PUT (by ID)
router.post('/range',
    VerifyToken(),
    conversionRatesController.getConversationsByRange);

router.post('/range/csv',
    VerifyToken(),
    conversionRatesController.getConversationsByRange,
    ExportCSV);

router.post('/',
    VerifyToken(),
    conversionRatesController.createConversions);

router.get('/',
    VerifyToken(),
    conversionRatesController.getAllConversions);

router.put('/:id',
    VerifyToken(),
    conversionRatesController.updateConversions);

module.exports = router;
