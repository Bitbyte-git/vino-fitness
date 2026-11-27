const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeTrainerParam } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const {
  getAvailabilities,
  getTrainerAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getTrainerLeave,
  setTrainerOnLeave,
  reactivateTrainer,
  submitScheduleRequest,
  getScheduleRequests,
  approveScheduleRequest,
  rejectScheduleRequest,
} = require('../controllers/trainerAvailabilityController');

router
  .route('/')
  .get(protect, authorize('admin'), getAvailabilities)
  .post(protect, authorize('admin'), createAvailability);

router.post('/request-change', protect, authorize('trainer', 'admin'), submitScheduleRequest);
router.get('/requests', protect, authorize('trainer', 'admin'), getScheduleRequests);
router.post('/requests/:id/approve', protect, authorize('admin'), auditLogger('approve_schedule', 'trainer_availability'), approveScheduleRequest);
router.post('/requests/:id/reject', protect, authorize('admin'), auditLogger('reject_schedule', 'trainer_availability'), rejectScheduleRequest);

router.get('/trainer/:trainerId', protect, authorizeTrainerParam('trainerId'), getTrainerAvailability);
router.get('/leave/:trainerId', protect, authorize('admin'), getTrainerLeave);
router.post('/leave/:trainerId', protect, authorize('admin'), auditLogger('place_on_leave', 'trainer'), setTrainerOnLeave);
router.post('/reactivate/:trainerId', protect, authorize('admin'), auditLogger('reactivate', 'trainer'), reactivateTrainer);

router
  .route('/:id')
  .put(protect, authorize('admin'), updateAvailability)
  .delete(protect, authorize('admin'), deleteAvailability);

module.exports = router;
