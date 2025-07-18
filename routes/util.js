const express = require('express');
const router = express.Router();
const {
    SeedDB,
    KPIs,
    GetKPIs,
    CallToAction,
    InsertKPI,
    GetKPIsV2
} = require('../controllers/util');
const { VerifyToken } = require('../middlewares');
const { Upload } = require('../controllers/upload');

// We only have POST, GET all, and PUT (by ID)
router
    .post('/seed',
        SeedDB
    )
    .post('/kpi',
        InsertKPI
    )
    .get('/kpi',
        // VerifyToken(),
        GetKPIsV2
    )
    .post('/call-to-action',
        CallToAction
    )
    .post('/upload',
        VerifyToken(),
        Upload
    )

module.exports = router;
