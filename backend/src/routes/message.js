const { Router } = require('express');
const ctrl = require('../controllers/messageController');
const { authMiddleware: auth, adminMiddleware: adminOnly } = require('../middleware/auth');

const router = Router();

router.get('/mine', auth, ctrl.myMessages);
router.post('/send', auth, ctrl.send);
router.get('/unread', auth, ctrl.unreadCount);
router.get('/admin/conversations', auth, adminOnly, ctrl.adminConversations);
router.get('/admin/:userId', auth, adminOnly, ctrl.adminGetMessages);
router.post('/admin/:userId/reply', auth, adminOnly, ctrl.adminReply);

module.exports = router;
