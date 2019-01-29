/*
 * @author David Menger
 */
'use strict';

const Processor = require('./src/Processor');
const Router = require('./src/Router');
const Request = require('./src/Request');
const Responder = require('./src/Responder');
const ReducerWrapper = require('./src/ReducerWrapper');
const Tester = require('./src/Tester');
const Ai = require('./src/Ai');
const WingbotModel = require('./src/wingbot/WingbotModel');
const CachedModel = require('./src/wingbot/CachedModel');
const { asserts } = require('./src/testTools');
const BuildRouter = require('./src/BuildRouter');
const ReturnSender = require('./src/ReturnSender');
const Plugins = require('./src/Plugins');
const { callbackMiddleware, sustainCallback } = require('./src/middlewares/callback');
const NotificationsStorage = require('./src/notifications/NotificationsStorage');
const Notifications = require('./src/notifications/Notifications');
const {
    GraphApi, validateBotApi, postBackApi, apiAuthorizer
} = require('./src/graphApi');
const { parseActionPayload } = require('./src/utils');
const {
    bufferloader,
    MemoryStateStorage,
    Translate
} = require('./src/tools');

module.exports = {
    // basic functionality
    ReturnSender,
    Processor,
    Router,
    Request,
    Responder,
    ReducerWrapper,

    // utilities
    Tester,
    bufferloader,
    asserts,
    MemoryStateStorage,
    Translate,
    CachedModel,
    parseActionPayload,

    // Wingbot
    ai: Ai.ai,
    Plugins,
    BuildRouter,
    // @deprecated
    validateBot: validateBotApi,
    WingbotModel,

    // middlewares
    callbackMiddleware,
    sustainCallback,

    // Notifications
    Notifications,
    NotificationsStorage,

    // Api
    GraphApi,
    apiAuthorizer,
    validateBotApi,
    postBackApi
};
