const { Router } = require('express');
const ctrl = require('../controllers/homeConfigController');
const { authMiddleware: auth, adminMiddleware: adminOnly } = require('../middleware/auth');

const router = Router();

router.get('/', ctrl.list);
router.post('/', auth, adminOnly, ctrl.create);
router.put('/:id', auth, adminOnly, ctrl.update);
router.delete('/:id', auth, adminOnly, ctrl.remove);

module.exports = router;
