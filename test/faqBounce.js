/**
 * @author David Menger
 */
'use strict';

// @ts-ignore
const testbot = require('./faq-testbot.json');
const Tester = require('../src/Tester');
const BuildRouter = require('../src/BuildRouter');

describe('FAQ BOUNCE', async () => {

    /**
     * @type {Tester}
     */
    let t;

    beforeEach(() => {
        const bot = BuildRouter.fromData(testbot.data);

        t = new Tester(bot);
    });

    it('passes recognized entity to the target interaction', async () => {
        await t.postBack('allowed-and-then-do-not-return');

        await t.intentWithEntity('faq-with-entity', 'entity', 'sasalele');

        t.any().contains('entity is sasalele');

        // ensure the context works
        await t.postBack('/faq/with-faq-and-entity');

        t.any().contains('entity is sasalele');

        // the second attempt resets the context
        await t.postBack('/faq/with-faq-and-entity');

        t.any().contains('entity is');
    });

    it('allowed and then do not return WITH FAQ', async () => {
        await t.postBack('allowed-and-then-do-not-return');

        await t.intent('withFaq');

        t.any()
            .contains('text with faq')
            .contains('btn with faq')
            .contains('followup')
            .notContains('fallback');
    });

    it('allowed and then do not return WITHOUT FAQ', async () => {
        await t.postBack('allowed-and-then-do-not-return');

        await t.intent('withoutFaq');

        t.any()
            .contains('text without faq')
            .contains('followup')
            .notContains('fallback');
    });

    it('allowed and then do not return WITHOUT FAQ DIRECT', async () => {
        await t.postBack('allowed-and-then-do-not-return');

        await t.text('any');

        t.any()
            .notContains('text without faq')
            .notContains('followup')
            .contains('fallback');
    });

    it('allowed and then return if possible WITH FAQ', async () => {
        await t.postBack('allowed-and-then-return-if-possible');

        await t.intent('withFaq');

        t.any()
            .contains('text with faq')
            .contains('btn with faq')
            .notContains('btn no faq')
            .notContains('followup')
            .contains('fallback');
    });

    it('allowed and then return if possible WITHOUT FAQ', async () => {
        await t.postBack('allowed-and-then-return-if-possible');

        await t.intent('withoutFaq');

        t.any()
            .contains('text without faq')
            .contains('followup')
            .notContains('fallback');
    });

    it('allowed and then return if possible WITHOUT FAQ DIRECT', async () => {
        await t.postBack('allowed-and-then-return-if-possible');

        await t.text('any');

        t.any()
            .notContains('text without faq')
            .notContains('followup')
            .contains('fallback');
    });

    it('allowed to FAQ and then return here WITH FAQ', async () => {
        await t.postBack('allowed-to-faq-and-then-return-here');

        await t.intent('withFaq');

        t.any()
            .contains('text with faq')
            .contains('btn with faq')
            .notContains('followup')
            .contains('first fallback');
    });

    it('allowed to FAQ and then return here WITHOUT FAQ', async () => {
        await t.postBack('allowed-to-faq-and-then-return-here');

        await t.intent('withoutFaq');

        t.any()
            .notContains('text without faq')
            .notContains('followup')
            .contains('second fallback');
    });

    it('allowed to FAQ and then return here WITHOUT FAQ DIRECT', async () => {
        await t.postBack('allowed-to-faq-and-then-return-here');

        await t.text('any');

        t.any()
            .notContains('text without faq')
            .notContains('followup')
            .contains('second fallback');
    });

    it('allowed to FAQ and then return to interaction WITH FAQ', async () => {
        await t.postBack('allowed-to-faq-and-then-return-to-interaction');

        await t.intent('withFaq');

        t.any()
            .contains('text with faq')
            .contains('btn with faq')
            .notContains('followup')
            .notContains('fallback')
            .contains('interaction');
    });

    it('allowed to FAQ and then return to interaction WITHOUT FAQ', async () => {
        await t.postBack('allowed-to-faq-and-then-return-to-interaction');

        await t.intent('withoutFaq');

        t.any()
            .notContains('text without faq')
            .notContains('followup')
            .contains('fallback');
    });

    it('allowed to FAQ and then return to interaction WITHOUT FAQ DIRECT', async () => {
        await t.postBack('allowed-to-faq-and-then-return-to-interaction');

        await t.text('any');

        t.any()
            .notContains('text without faq')
            .notContains('followup')
            .contains('fallback');
    });

    it('keeps context when bouncing to entity', async () => {
        await t.postBack('allowed-and-then-do-not-return');

        await t.intentWithEntity('faq-with-entity', 'entity', 'lala');

        t.any()
            .contains('entity is lala');

        await t.postBack('/faq/entity-test');

        t.any()
            .contains('entity in state lala');

        await t.postBack('/faq/entity-test');

        t.any()
            .contains('entity in state lala');
    });

});
