/*
 * @author David Menger
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildSchema } = require('graphql');
const { GraphApi, postBackApi, validateBotApi } = require('../../src/graphApi');
const { Notifications } = require('../../src/notifications');
const Router = require('../../src/Router');
const Tester = require('../../src/Tester');
const BuildRouter = require('../../src/BuildRouter');
const Plugins = require('../../src/Plugins');
// @ts-ignore
const simpleTestbot = require('../simple-testbot.json');

describe('<GraphApi>', () => {

    /** @type {GraphApi} */
    let api;

    let headers;

    let campaign;

    /** @type {Tester} */
    let tester;

    let receivedActionData;

    let schema;

    before(() => {
        const schemaFile = path.resolve(__dirname, '..', '..', 'src', 'graphApi', 'schema.gql');
        schema = fs.readFileSync(schemaFile, { encoding: 'utf8' });
        schema = buildSchema(schema);
    });

    beforeEach(async () => {
        const bot = new Router();

        bot.use('start', (req, res) => {
            receivedActionData = req.action(true);
            res.text('Hello');
        });

        bot.use((req, res) => {
            res.text('Fallback');
        });

        tester = new Tester(bot);

        const notifications = new Notifications();

        api = new GraphApi([
            notifications.api(),
            postBackApi(tester),
            validateBotApi(() => new BuildRouter({ botId: 'a', snapshot: 'b' }, new Plugins()), 'start', '*')
        ], {
            token: 'x',
            appToken: 'y'
        });

        api._cachedSchema = schema;

        headers = { Authorization: 'y' };

        await notifications.subscribe('1', '1', 'foo');

        await notifications.subscribe('2', '2', 'bar');

        campaign = await notifications.createCampaign('name', 'action', {}, { active: true });
    });

    describe('{ version }', () => {

        it('should return the version', async () => {
            const res = await api.request({
                query: '{ version }'
            }, headers);

            assert.equal(typeof res.data.version, 'string');
        });

        it('should throw an error without auth header', async () => {
            let catchedError = null;
            try {
                await api.request({
                    query: '{ version }'
                }, {});
            } catch (e) {
                catchedError = e;
            }

            assert.equal(catchedError.message, 'Unauthorized');
            assert.equal(catchedError.code, 401);
            assert.equal(catchedError.status, 401);
        });

        it('should throw an error with random token', async () => {
            let catchedError = null;
            try {
                await api.request({
                    query: '{ version }'
                }, {
                    Authorization: 'foo'
                });
            } catch (e) {
                catchedError = e;
            }

            assert.equal(catchedError.message, 'Forbidden: Unknown key format');
            assert.equal(catchedError.code, 403);
            assert.equal(catchedError.status, 403);
        });

        it('should throw an error with random JWT token', async () => {
            let catchedError = null;
            try {
                await api.request({
                    query: '{ version }'
                }, {
                    Authorization: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
                });
            } catch (e) {
                catchedError = e;
            }

            assert.equal(catchedError.message, 'Forbidden: Token does not match');
            assert.equal(catchedError.code, 403);
            assert.equal(catchedError.status, 403);
        });

        //

        it('should throw an error with invalid JWT token', async () => {
            let catchedError = null;
            try {
                await api.request({
                    query: '{ version }'
                }, {
                    Authorization: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEifQ.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsInRva2VuIjoieCIsImlhdCI6MTUxNjIzOTAyMn0.fvte1M18oxV6OwgqVzXSL10nbPUXr30bwV3GZu3Alj7FYsZvBz9yN4PVnv3YRfAtVWjBzj6CXwB1AhwhIn0RQ6akg4OKrDWoiv5NQTNr6TU1P-xmT4FJFkjDc8atpKEx4Cq4QgNRa2OjKhEl2FzklciYmkxgl60bD19Y1kbmJQg'
                });
            } catch (e) {
                catchedError = e;
            }

            assert.equal(catchedError.message, 'Forbidden: No key found');
            assert.equal(catchedError.code, 403);
            assert.equal(catchedError.status, 403);
        });

    });

    describe('mutation { validateBot () }', () => {

        it('validates invalid bot', async () => {
            const res = await api.request({
                query: `mutation ValidateBot (
                    $bot:Any!
                ) {
                    validateBot (
                        bot:$bot
                    ) {
                        ok,
                        error
                    }
                }`,
                variables: {
                    bot: {
                        blocks: []
                    }
                }
            }, headers);

            assert.equal(typeof res.data, 'object');
            assert.deepEqual(res.data, {
                validateBot: {
                    ok: false,
                    error: 'Bot build failed: Cannot destructure property `blockName` of \'undefined\' or \'null\'.'
                }
            });
        });

        it('validates bot', async () => {
            const res = await api.request({
                query: `mutation ValidateBot (
                    $bot:Any!
                ) {
                    validateBot (
                        bot:$bot
                    ) {
                        ok,
                        error
                    }
                }`,
                variables: {
                    bot: simpleTestbot
                }
            }, headers);

            assert.equal(typeof res.data, 'object');
            assert.deepEqual(res.data, {
                validateBot: {
                    error: null,
                    ok: true
                }
            });
        });

    });

    describe('mutation { postBack () }', () => {

        it('should work without data', async () => {
            const res = await api.request({
                query: `mutation SendPostBack (
                    $pageId:String!,
                    $senderId:String!,
                    $action:String!,
                    $data:Any
                ) {
                    postBack (
                        pageId:$pageId,
                        senderId:$senderId,
                        action:$action,
                        data:$data
                    ) {
                        status
                    }
                }`,
                variables: {
                    senderId: tester.senderId,
                    pageId: tester.pageId,
                    action: 'start'
                }
            }, headers);

            assert.equal(typeof res.data, 'object');
            assert.deepEqual(res.data, {
                postBack: { status: 200 }
            });
        });

        it('should work with data', async () => {
            const res = await api.request({
                query: `mutation SendPostBack (
                    $pageId:String!,
                    $senderId:String!,
                    $action:String!,
                    $data:Any
                ) {
                    postBack (
                        pageId:$pageId,
                        senderId:$senderId,
                        action:$action,
                        data:$data
                    ) {
                        status
                    }
                }`,
                variables: {
                    senderId: tester.senderId,
                    pageId: tester.pageId,
                    action: 'start',
                    data: { foo: 'bar', x: [1] }
                }
            }, headers);

            assert.equal(typeof res.data, 'object');
            assert.deepEqual(res.data, {
                postBack: { status: 200 }
            });
            assert.deepEqual(receivedActionData, { foo: 'bar', x: [1] });
        });

    });

    describe('{ campaigns }', () => {

        it('should return all campaigns', async () => {
            const res = await api.request({
                query: '{ campaigns (limit: 1) { data { name } } }'
            }, headers);

            assert.ok(Array.isArray(res.data.campaigns.data));
        });

    });

    describe('{ tags }', () => {

        it('should return tags statistics', async () => {
            const res = await api.request({
                query: '{ tags { data { tag, subscribtions } } }'
            }, headers);

            assert.ok(Array.isArray(res.data.tags.data));
            assert.equal(res.data.tags.data.length, 2);
        });

    });

    describe('{ subscribtions }', () => {

        it('should return paginated subscribtions', async () => {
            const res = await api.request({
                query: `{
                    subscribtions (limit: 1) {
                        data { pageId, senderId }
                        lastKey
                    }
                }`
            }, headers);

            const { data, lastKey } = res.data.subscribtions;

            assert.ok(Array.isArray(data));
            assert.strictEqual(typeof lastKey, 'string');

            const res2 = await api.request({
                query: `query GetSubscribtions ($lastKey: String) {
                    subscribtions (limit: 1, lastKey: $lastKey) {
                        data { pageId, senderId }
                        lastKey
                    }
                }`,
                variables: {
                    lastKey
                }
            }, headers);

            const { data: data2, lastKey: lk2 } = res2.data.subscribtions;

            assert.ok(Array.isArray(data2));
            assert.strictEqual(lk2, null);
        });

        it('should be able to calculate count', async () => {
            const res = await api.request({
                query: `{
                    subscribtions {
                        count
                    }
                }`
            }, headers);

            const { count } = res.data.subscribtions;

            assert.strictEqual(count, 2);
        });

    });

    describe('mutation { createCampaign () }', () => {

        it('should create a campaign', async () => {
            const createCampaign = {
                name: 'test',
                action: 'start'
            };

            const res = await api.request({
                query: `mutation CreateCampaign ($campaign: CreateCampaignInput!) {
                    createCampaign (campaign: $campaign) {
                        name, action, id
                    }
                }`,
                variables: {
                    campaign: createCampaign
                }
            }, headers);

            const { id } = res.data.createCampaign;

            delete res.data.createCampaign.id;

            assert.deepEqual(res.data, {
                createCampaign
            });

            const createdCampaign = await api.request({
                query: `query GetCampaignById ($campaignId: String!) {
                    campaign (campaignId: $campaignId) {
                        id
                    }
                }`,
                variables: {
                    campaignId: id
                }
            }, headers);

            assert.strictEqual(createdCampaign.data.campaign.id, id);
        });

    });

    describe('mutation { updateCampaign () }', () => {

        it('should update existing campaign', async () => {
            const res = await api.request({
                query: `mutation UpdateCampaign ($campaignId: String!, $update: UpdateCampaignInput!) {
                    updateCampaign (campaignId: $campaignId, update: $update) {
                        name, action, active
                    }
                }`,
                variables: {
                    campaignId: campaign.id,
                    update: {
                        active: true,
                        name: 'Goo'
                    }
                }
            }, headers);

            assert.equal(typeof res.data, 'object');

            assert.deepEqual(res.data, {
                updateCampaign: {
                    name: 'Goo',
                    action: 'action',
                    active: true
                }
            });
        });

    });

    describe('mutation { removeCampaign () }', () => {

        it('should remove existing campaign', async () => {
            const res = await api.request({
                query: `mutation RemoveCampaign ($campaignId: String!) {
                    removeCampaign (campaignId: $campaignId)
                }`,
                variables: {
                    campaignId: campaign.id
                }
            }, headers);

            assert.equal(typeof res.data, 'object');
            assert.deepEqual(res.data, {
                removeCampaign: true
            });
        });

    });

    describe('mutation { runCampaign () }', () => {

        it('should remove existing campaign', async () => {
            const res = await api.request({
                query: `mutation RunCampaign ($campaignId: String!) {
                    runCampaign (campaignId: $campaignId) {
                        queued
                    }
                }`,
                variables: {
                    campaignId: campaign.id
                }
            }, headers);

            assert.equal(typeof res.data, 'object');
            assert.deepEqual(res.data, {
                runCampaign: { queued: 2 }
            });
        });

    });

});
