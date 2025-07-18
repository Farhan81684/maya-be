const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversations');
const { ExportCSV } = require('../middlewares');

// We only have POST, GET all, and PUT (by ID)
router.post('/range', conversationController.getConversationsByRange);
router.post('/range/csv', conversationController.getConversationsByRangeCSV, ExportCSV);
router.post('/', conversationController.createConversationAnalytics);
router.get('/', conversationController.getAllConversations);
router.put('/:id', conversationController.updateConversation);

module.exports = router;
