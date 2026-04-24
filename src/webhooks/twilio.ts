import { Router, urlencoded } from 'express';
import twilio from 'twilio';
import { env } from '../env.js';
import { verifyTwilioSignature } from '../lib/verifySignature.js';
import { logger } from '../lib/logger.js';
import { upsertCallByVapiId } from '../services/calls.js';

export const twilioRouter = Router();

twilioRouter.post(
  '/call',
  urlencoded({ extended: false }),
  verifyTwilioSignature,
  async (req, res) => {
    const body = (req.body ?? {}) as Record<string, string>;
    const callSid = body.CallSid ?? '';
    const from = body.From ?? '';

    logger.info({ callSid, from }, 'Inbound Twilio call');

    try {
      await upsertCallByVapiId({
        twilio_call_sid: callSid,
        phone_from: from,
        status: 'in_progress',
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log inbound call');
    }

    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial({ answerOnBridge: true });
    dial.sip(env.VAPI_PHONE_SIP);

    res.type('text/xml').send(twiml.toString());
  },
);
