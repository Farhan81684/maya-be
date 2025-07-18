const express = require('express');
const router = express.Router();
const { getTalkTimeByRange, endTalkTime, createTalkTime, getAllTalkTime, GetCallToAction, GetCallToActionCSV, getTalkTimeByRangeCSV } = require('../controllers/talkTime');
const { VerifyToken, ExportCSV } = require('../middlewares');

// POST, GET all, PUT (by ID)
router.post('/range',
    VerifyToken(),
    getTalkTimeByRange);

router.post('/range/csv',
    VerifyToken(),
    getTalkTimeByRangeCSV,
    ExportCSV);

router.post('/end',
    endTalkTime);

router.post('/',
    createTalkTime);

router.get('/',
    VerifyToken(),
    getAllTalkTime);

router.get(
    '/call-to-action',
    GetCallToAction);

router.get(
    '/call-to-action/csv',
    GetCallToActionCSV,
    ExportCSV);

module.exports = router;
