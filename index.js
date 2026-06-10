'use strict';

const { version } = require('zapier-platform-core');

const authentication = require('./authentication');
const { addJwtToBundle } = require('./jwt_middleware');

// Triggers
const inboundSms = require('./triggers/inbound_sms');
const inboundMessage = require('./triggers/inbound_message');
const inboundCall = require('./triggers/inbound_call');
const callStatus = require('./triggers/call_status');
const messageStatus = require('./triggers/message_status');
const verifyEvent = require('./triggers/verify_event');

// Creates (Actions)
const sendSms = require('./creates/send_sms');
const sendMessage = require('./creates/send_message');
const makeCall = require('./creates/make_call');
const sendVerify = require('./creates/send_verify');
const checkVerify = require('./creates/check_verify');
const cancelVerify = require('./creates/cancel_verify');

// Searches
const numberInsight = require('./searches/number_insight');

module.exports = {
  version: require('./package.json').version,
  platformVersion: version,

  authentication,

  beforeRequest: [addJwtToBundle],

  flags: {
    cleanInputData: false,
  },

  triggers: {
    [inboundSms.key]: inboundSms,
    [inboundMessage.key]: inboundMessage,
    [inboundCall.key]: inboundCall,
    [callStatus.key]: callStatus,
    [messageStatus.key]: messageStatus,
    [verifyEvent.key]: verifyEvent,
  },

  creates: {
    [sendSms.key]: sendSms,
    [sendMessage.key]: sendMessage,
    [makeCall.key]: makeCall,
    [sendVerify.key]: sendVerify,
    [checkVerify.key]: checkVerify,
    [cancelVerify.key]: cancelVerify,
  },

  searches: {
    [numberInsight.key]: numberInsight,
  },
};
