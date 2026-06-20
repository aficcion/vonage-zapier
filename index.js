'use strict';

const { version } = require('zapier-platform-core');

const authentication = require('./authentication');
const { addJwtToBundle, refreshOnInvalidJwt } = require('./jwt_middleware');

// Triggers
const inboundMessage = require('./triggers/inbound_message');
const inboundCall = require('./triggers/inbound_call');
const callStatus = require('./triggers/call_status');
const messageStatus = require('./triggers/message_status');
const verifyEvent = require('./triggers/verify_event');
const listNumbers = require('./triggers/list_numbers');
const listSenders = require('./triggers/list_senders');

// Creates (Actions)
const sendSms = require('./creates/send_sms');
const sendMessage = require('./creates/send_message');
const sendWhatsapp = require('./creates/send_whatsapp');
const sendRcs = require('./creates/send_rcs');
const makeCall = require('./creates/make_call');
const sendVerify = require('./creates/send_verify');
const checkVerify = require('./creates/check_verify');
const cancelVerify = require('./creates/cancel_verify');
const apiRequest = require('./creates/api_request');

// Searches
const numberInsight = require('./searches/number_insight');
const getBalance = require('./searches/get_balance');

module.exports = {
  version: require('./package.json').version,
  platformVersion: version,

  authentication,

  beforeRequest: [addJwtToBundle],

  afterResponse: [refreshOnInvalidJwt],

  flags: {
    // SC-06 — cleanInputData:false is intentional. Zapier's default cleaner
    // trims/normalises input values, which would corrupt the data this connector
    // passes through verbatim: multi-line PEM private keys (Advanced auth) and
    // raw JSON bodies (API Request, Template Components, Custom Workflow). Keep
    // it off so those reach Vonage exactly as the maker entered them.
    cleanInputData: false,
  },

  triggers: {
    [inboundMessage.key]: inboundMessage,
    [inboundCall.key]: inboundCall,
    [callStatus.key]: callStatus,
    [messageStatus.key]: messageStatus,
    [verifyEvent.key]: verifyEvent,
    [listNumbers.key]: listNumbers,
    [listSenders.key]: listSenders,
  },

  creates: {
    [sendSms.key]: sendSms,
    [sendMessage.key]: sendMessage,
    [sendWhatsapp.key]: sendWhatsapp,
    [sendRcs.key]: sendRcs,
    [makeCall.key]: makeCall,
    [sendVerify.key]: sendVerify,
    [checkVerify.key]: checkVerify,
    [cancelVerify.key]: cancelVerify,
    [apiRequest.key]: apiRequest,
  },

  searches: {
    [numberInsight.key]: numberInsight,
    [getBalance.key]: getBalance,
  },
};
