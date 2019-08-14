/**
 * @author David Menger
 */
'use strict';

const assert = require('assert');
const ReturnSender = require('../src/ReturnSender');

describe('<ReturnSender>', () => {

    describe('#send() & finished()', () => {

        it('should retain catched error', async () => {
            const rs = new ReturnSender({}, 'a', {});

            rs.simulateFail = true;

            rs.send({ a: 1 });

            rs.send({ wait: 100 });

            rs.simulateFail = true;

            rs.send({ b: 1 });

            await new Promise(r => setTimeout(r, 10));

            const res = await rs.finished();

            assert.equal(res.status, 500);
        });

    });

    describe('#textFilter', () => {

        it('is able to filter text data', async () => {
            const collect = [];
            const log = (...args) => collect.push(args);

            const rs = new ReturnSender(
                { textFilter: () => 'good' },
                'a',
                { message: { text: 'bad' } },
                // @ts-ignore
                { log, error: log, info: log }
            );

            rs.send({ message: { text: 'bad' } });

            rs.send({ message: { attachment: { type: 'template', payload: { text: 'bad' } } } });

            const res = await rs.finished();

            assert.equal(res.status, 200);
            assert.deepEqual(collect, [
                [
                    'a',
                    [
                        { message: { text: 'good' } },
                        { message: { attachment: { type: 'template', payload: { text: 'good' } } } }
                    ],
                    { message: { text: 'good' } },
                    {}
                ]
            ]);

        });

    });

});
