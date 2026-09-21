'use strict';

/**
 * HealPoint - Hospital Admin slot routes (drop-in module).
 *
 * Mount behind the existing backend auth + role middleware so every route
 * requires an authenticated Hospital Admin request.
 *
 * Mounting (see README):
 *   const createSlotRoutes = require('./server-slots/routes/slotRoutes');
 *   app.use('/api/v1/admin/slots',
 *     requireRole('admin'),
 *     createSlotRoutes({ slotModel, doctorModel, auditModel }));
 *
 * Security is enforced in the controller: even with a valid admin token, a
 * request for another hospital's doctor/slot is refused (TEST 12).
 *
 */
const createSlotController = require('../controllers/slotController');

function createSlotRoutes(deps = {}) {
  const express = require('express');
  const controller = deps.controller || createSlotController(deps);
  const router = express.Router();

  const slotModel = deps.slotModel;
  const doctorModel = deps.doctorModel;
  const auditModel = deps.auditModel;
  const appointmentModel = deps.appointmentModel;
  router.use((req, res, next) => {
    req.models = req.models || {};
    if (slotModel) req.models.Slot = slotModel;
    if (doctorModel) req.models.Doctor = doctorModel;
    if (auditModel) req.models.Audit = auditModel;
    if (appointmentModel) req.models.Appointment = appointmentModel;
    next();
  });

  router.get('/hospital/calendar', controller.hospitalCalendar);
  router.get('/:doctorId/preview', controller.preview);
  router.post('/:doctorId/generate', controller.generate);
  router.post('/:doctorId/regenerate', controller.regenerate);
  router.get('/:doctorId/calendar', controller.calendar);
  router.get('/:doctorId/availability', controller.availability);
  router.post('/:doctorId/block', controller.block);
  router.post('/:doctorId/unblock', controller.unblock);
  router.post('/:doctorId/bulk/preview', controller.bulkPreview);
  router.post('/:doctorId/bulk/apply', controller.bulkApply);
  router.post('/:doctorId/bulk/block', controller.bulkBlock);
  router.post('/:doctorId/bulk/unblock', controller.bulkUnblock);
  router.post('/:doctorId/clear-unbooked', controller.clearUnbooked);
  router.get('/:doctorId/conflicts', controller.conflicts);

  return router;
}

/**
 * Convenience: mount under /api/v1/admin/slots using the backend's own auth
 * + role middlewares. Safe fallback double-checks role admin/super_admin.
 *
 * Patient + doctor mounts (same source of truth, own auth scopes):
 *   mountSlotPatientRoutes(app, deps)
 *     -> GET /api/v1/slots/availability/:doctorId?date=DD-MM-YYYY (patient JWT)
 *   mountSlotDoctorRoutes(app, deps)
 *     -> GET /api/v1/doctor/slots/calendar?fromDate&toDate      (doctor JWT)
 *     -> GET /api/v1/doctor/slots/availability?date=DD-MM-YYYY  (doctor JWT)
 *
 * The mounting app supplies its OWN auth/role middleware (patientJWT,
 * doctorJWT). Doctors can only ever read their OWN slots (id from JWT).
 */
function mountSlotRoutes(app, deps = {}) {
  const authMiddleware = deps.authMiddleware;
  const roleMiddleware = deps.roleMiddleware || ((req, res, next) => {
    const role = String((req.user && req.user.role) || (req.admin && req.admin.role) || '');
    if (role === 'admin' || role === 'super_admin') return next();
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  });
  const chain = authMiddleware ? [authMiddleware, roleMiddleware] : [roleMiddleware];
  app.use('/api/v1/admin/slots', ...chain, createSlotRoutes(deps));
}

function wireModels(router, deps) {
  const slotModel = deps.slotModel;
  const doctorModel = deps.doctorModel;
  const auditModel = deps.auditModel;
  const appointmentModel = deps.appointmentModel;
  router.use((req, res, next) => {
    req.models = req.models || {};
    if (slotModel) req.models.Slot = slotModel;
    if (doctorModel) req.models.Doctor = doctorModel;
    if (auditModel) req.models.Audit = auditModel;
    if (appointmentModel) req.models.Appointment = appointmentModel;
    next();
  });
}

/**
 * Patient mount: single-day availability for a doctor from the SAME Slot
 * inventory the admin generates. Mount behind the patient JWT middleware.
 * The legacy `/appointment/get-available-slots/:doctorId` stays untouched;
 * this gives the app a synced alternative that hides blocked slots.
 */
function mountSlotPatientRoutes(app, deps = {}) {
  const express = require('express');
  const controller = deps.controller || createSlotController(deps);
  const router = express.Router();
  wireModels(router, deps);
  router.get('/availability/:doctorId', controller.availability);
  const chain = deps.authMiddleware ? [deps.authMiddleware] : [];
  app.use('/api/v1/slots', ...chain, router);
  return router;
}

/**
 * Doctor Portal mount: the signed-in doctor reads ONLY their own slots
 * (doctor id resolved from the verified doctor JWT, never from params).
 * Mount behind the doctor JWT middleware.
 */
function mountSlotDoctorRoutes(app, deps = {}) {
  const express = require('express');
  const controller = deps.controller || createSlotController(deps);
  const router = express.Router();
  wireModels(router, deps);
  router.get('/calendar', controller.doctorCalendar);
  router.get('/availability', controller.doctorAvailability);
  const chain = deps.authMiddleware ? [deps.authMiddleware] : [];
  app.use('/api/v1/doctor/slots', ...chain, router);
  return router;
}

module.exports = createSlotRoutes;
module.exports.mountSlotRoutes = mountSlotRoutes;
module.exports.mountSlotPatientRoutes = mountSlotPatientRoutes;
module.exports.mountSlotDoctorRoutes = mountSlotDoctorRoutes;
module.exports.createSlotRoutes = createSlotRoutes;
