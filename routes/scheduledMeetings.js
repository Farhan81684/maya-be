const express = require('express');
const router = express.Router();
const scheduledMeetingsController = require('../controllers/scheduledMeetings');
const { VerifyToken, ExportCSV } = require('../middlewares');

// POST, GET all, PUT (by ID)
router.post('/range',
    VerifyToken(),
    scheduledMeetingsController.getMeetingsByRange);

router.post('/range/csv',
    VerifyToken(),
    scheduledMeetingsController.getMeetingsByRange,
    ExportCSV);

router.post('/timeframe',
    VerifyToken(),
    scheduledMeetingsController.GetByTimeframe);

router.post('/graph',
    // VerifyToken(),
    scheduledMeetingsController.GetGraph);

router.post('/',
    VerifyToken(),
    scheduledMeetingsController.createScheduledMeeting);

router.get('/',
    VerifyToken(),
    scheduledMeetingsController.getAllScheduledMeetings);

router.put('/:id',
    VerifyToken(),
    scheduledMeetingsController.updateScheduledMeeting);

module.exports = router;
