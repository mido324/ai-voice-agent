import { Router, json } from 'express';
import { verifyVapiSecret } from '../lib/verifySignature.js';
import { captureLeadHandler } from './captureLead.js';
import { checkAvailabilityHandler } from './checkAvailability.js';
import { bookAppointmentHandler } from './bookAppointment.js';

export const toolsRouter = Router();

const jsonBody = json({ limit: '1mb' });

toolsRouter.post('/capture-lead', jsonBody, verifyVapiSecret, captureLeadHandler);
toolsRouter.post('/check-availability', jsonBody, verifyVapiSecret, checkAvailabilityHandler);
toolsRouter.post('/book-appointment', jsonBody, verifyVapiSecret, bookAppointmentHandler);
