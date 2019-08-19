/*
 * @author David Menger
 */
'use strict';

const { replaceDiacritics } = require('./utils/tokenizer');

const FULL_EMOJI_REGEX = /^#((?:[\u2600-\u27bf].?|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])+)$/;
const HAS_CLOSING_HASH = /^#(.+)#$/;
const ENTITY_REGEX = /^@([^=><!?]+)(\?)?([!=><]{1,2})?([^=><!]+)?$/i;

/**
 * @typedef {string} Compare
 */

/**
 * @enum {Compare}
 */
const COMPARE = {
    EQUAL: 'eq',
    NOT_EQUAL: 'ne',
    RANGE: 'range',
    GT: 'gt',
    GTE: 'gte',
    LT: 'lt',
    LTE: 'lte'
};

/**
 * @typedef {Object} Entity
 * @param {string} entity
 * @param {string} value
 * @param {number} score
 */

/**
 * @typedef {Object} Intent
 * @param {string} [intent]
 * @param {number} score
 * @param {Entity[]} [entities]
 */

/**
 * @typedef {Object} EntityExpression
 * @prop {string} entity - the requested entity
 * @prop {boolean} [optional] - the match is optional
 * @prop {Compare} [op] - comparison operation
 * @prop {string[]|number[]} [compare] - value to compare with
 */


/**
 * @typedef {string|EntityExpression} IntentRule
 */

/**
 * @typedef {Object} RegexpComparator
 * @prop {RegExp} r - regular expression
 * @prop {boolean} t - use normalized text
 */

/**
 * @typedef {Object} PreprocessorOutput
 * @prop {RegexpComparator[]} regexps
 * @prop {string[]} intents
 * @prop {EntityExpression[]} entities
 */

/**
 * @typedef {Object} AIRequest
 * @prop {Function} text
 * @prop {Intent[]|null} intents
 * @prop {Entity[]} entities
 */

/**
 * @class {AiMatching}
 *
 * Class responsible for NLP Routing by score
 */
class AiMatching {

    constructor () {
        /**
         * When the entity is optional, the final score should be little bit lower
         * (0.001 by default)
         *
         * @type {number}
         */
        this.optionalHandicap = 0.001;

        /**
         * When there are additional entities then required add a handicap for each unmatched entity
         * Also works, when an optional entity was not matched
         *
         * @type {number}
         */
        this.redundantHandicap = 0.05;

        /**
         * When more than one AI features (Intent, Entity, Regex) are matching,
         * enrich the score using the {multiMatchGain} ^ {additionalFeaturesCount}
         *
         * @type {number}
         */
        this.multiMatchGain = 1.2;
    }

    _normalizeToNumber (value, returnIfEmpty = null) {
        if (typeof value === 'string') {
            const flt = parseFloat(value);
            return Number.isNaN(flt) ? returnIfEmpty : flt;
        }
        if (typeof value === 'number') {
            return value;
        }
        return returnIfEmpty;
    }

    _normalizeComparisonArray (compare, op) {
        const arr = Array.isArray(compare) ? compare : [compare];

        if ([
            COMPARE.GTE,
            COMPARE.GT,
            COMPARE.LTE,
            COMPARE.LT
        ].includes(op)) {
            const [val] = arr;

            return [
                this._normalizeToNumber(val)
            ];
        }

        if (op === COMPARE.RANGE) {
            const [min, max] = arr;

            return [
                this._normalizeToNumber(min, -Infinity),
                this._normalizeToNumber(max, Infinity)
            ];
        }

        return arr.map(cmp => `${cmp}`);
    }

    _stringOpToOperation (op) {
        switch (op) {
            case '>':
                return COMPARE.GT;
            case '>=':
            case '=>':
                return COMPARE.GTE;
            case '<':
                return COMPARE.LT;
            case '<=':
            case '=<':
                return COMPARE.LTE;
            case '!=':
                return COMPARE.NOT_EQUAL;
            case '<>':
            case '><':
                return COMPARE.RANGE;
            case '=':
            case '==':
            default:
                return COMPARE.EQUAL;
        }
    }

    _parseEntityString (entityString) {
        // eslint-disable-next-line prefer-const
        let [, entity, optional, op, compare] = entityString.trim().match(ENTITY_REGEX);

        optional = !!optional;

        if (!op || !compare) {
            return { entity, optional };
        }

        op = this._stringOpToOperation(op);
        compare = this._normalizeComparisonArray(compare.split(','), op);

        return {
            entity, op, compare, optional
        };
    }

    /**
     * Create a rule to be cached inside a routing structure
     *
     * @param {IntentRule|IntentRule[]} intent
     * @returns {PreprocessorOutput}
     */
    preprocessRule (intent) {
        const expressions = Array.isArray(intent) ? intent : [intent];

        const entities = expressions
            .filter(ex => typeof ex === 'object' || ex.match(/^@/))
            .map((ex) => {
                if (typeof ex === 'string') {
                    return this._parseEntityString(ex);
                }
                if (!ex.op) {
                    return ex;
                }

                return {
                    ...ex,
                    compare: this._normalizeComparisonArray(ex.compare, ex.op)
                };
            });

        /** @type {string[]} */
        // @ts-ignore
        const intents = expressions
            .filter(ex => typeof ex === 'string' && !ex.match(/^[#@]/));

        /**
         * 1. Emoji lists
         *      conversts #😀😃😄 to /^[😀😃😄]+$/ and matches not webalized
         * 2. Full word lists with a closing hash (opens match)
         *      convers #abc-123|xyz-34# to /abc-123|xyz-34/
         * 3. Full word lists without an open tag
         *      convers #abc-123|xyz-34 to /^abc-123$|^xyz-34$/
         */

        const regexps = expressions
            .filter(ex => typeof ex === 'string' && ex.match(/^#/))
            .map((rawExp) => {
                // @ts-ignore
                const exp = replaceDiacritics(rawExp);
                const fullEmoji = exp.match(FULL_EMOJI_REGEX);

                if (fullEmoji) {
                    return {
                        r: new RegExp(`^[${fullEmoji[1]}]+$`),
                        t: false
                    };
                }

                let regexText;

                const withClosingHash = exp.match(HAS_CLOSING_HASH);

                if (withClosingHash) {
                    [, regexText] = withClosingHash;
                    regexText = regexText.toLowerCase();
                } else {
                    regexText = exp.replace(/^#/, '')
                        .split('|')
                        .map(s => `^${s}$`.toLowerCase())
                        .join('|');
                }

                let r;
                try {
                    r = new RegExp(regexText);
                } catch (e) {
                    // fail - simply allows to use bad characters
                    regexText = regexText
                        .replace(/[a-z0-9|-]+/, '');
                    r = new RegExp(regexText);
                }

                return { r, t: true };
            });

        return { regexps, intents, entities };
    }

    /**
     * Calculate a matching score of preprocessed rule against the request
     *
     * @param {AIRequest} req
     * @param {PreprocessorOutput} rule
     * @returns {Intent|null}
     */
    match (req, rule) {
        const { regexps, intents, entities } = rule;

        const regexpMatching = this._matchRegexp(req, regexps);

        if (regexpMatching || (intents.length === 0 && regexps.length === 0)) {
            const noIntentHandicap = req.intents.length === 0 ? 0 : this.redundantHandicap;

            if (entities.length === 0) {
                if (!regexpMatching) {
                    return null;
                }
                const handicap = req.entities.length * this.redundantHandicap;
                return {
                    intent: null,
                    entites: [],
                    score: 1 - noIntentHandicap - handicap
                };
            }
            const { score, handicap, matched } = this._entityMatching(entities, req.entities);
            if (score === 0) {
                return null;
            }
            const countOfAdditionalItems = Math.max(matched.length - (regexpMatching ? 0 : 1), 0);
            return {
                intent: null,
                entities: matched,
                score: (score - noIntentHandicap - handicap)
                    * (this.multiMatchGain ** countOfAdditionalItems)
            };
        }

        if (!req.intents || req.intents.length === 0) {
            return null;
        }

        let winningIntent = null;

        intents
            .reduce((total, wantedIntent) => {
                let max = total;
                for (const requestIntent of req.intents) {
                    const score = this
                        ._intentMatchingScore(wantedIntent, requestIntent, entities, req.entities);

                    if (score > max) {
                        max = score;
                        winningIntent = {
                            ...requestIntent,
                            score
                        };
                    }
                }

                return max;
            }, 0);

        return winningIntent;
    }

    /**
     *
     * @private
     * @param {string} wantedIntent
     * @param {Intent} requestIntent
     * @param {EntityExpression[]} wantedEntities
     * @param {Entity[]} [allEntities]
     * @returns {number}
     */
    _intentMatchingScore (wantedIntent, requestIntent, wantedEntities, allEntities) {
        if (wantedIntent !== requestIntent.intent) {
            return 0;
        }

        const useEntities = requestIntent.entities || allEntities;

        if (wantedEntities.length === 0) {
            return requestIntent.score - (useEntities.length * this.redundantHandicap);
        }

        const { score, handicap, matched } = this
            ._entityMatching(wantedEntities, useEntities);

        if (score === 0) {
            return 0;
        }

        return (requestIntent.score - handicap) * (this.multiMatchGain ** matched.length);
    }

    /**
     *
     * @private
     * @param {EntityExpression[]} wantedEntities
     * @param {Entity[]} requestEntities
     * @returns {{score: number, handicap: number, matched: Entity[] }}
     */
    _entityMatching (wantedEntities, requestEntities = []) {
        const occurences = new Map();

        const matched = [];
        let handicap = 0;
        let sum = 0;

        for (const wanted of wantedEntities) {
            const start = occurences.has(wanted.entity)
                ? occurences.get(wanted.entity)
                : 0;

            const index = requestEntities
                .findIndex((e, i) => e.entity === wanted.entity && i >= start);

            const matching = index !== -1
                && this._entityIsMatching(wanted.op, wanted.compare, requestEntities[index].value);

            if (!matching && !wanted.optional) {
                return { score: 0, handicap: 0, matched: [] };
            }

            if (!matching) { // optional
                handicap += this.redundantHandicap;
                continue;
            }

            if (wanted.optional) {
                handicap += this.optionalHandicap;
            }

            matched.push(requestEntities[index]);
            sum += requestEntities[index].score;
            occurences.set(wanted.entity, index + 1);
        }

        handicap += (requestEntities.length - matched.length) * this.redundantHandicap;
        const score = matched.length === 0 ? 0 : sum / matched.length;

        return { score, handicap, matched };
    }

    _entityIsMatching (op, compare, value) {
        switch (op || (typeof compare !== 'undefined' ? COMPARE.EQUAL : null)) {
            case COMPARE.EQUAL:
                return compare.includes(`${value}`);
            case COMPARE.NOT_EQUAL:
                return !compare.includes(`${value}`);
            case COMPARE.RANGE: {
                const [min, max] = compare;
                const normalized = this._normalizeToNumber(value);
                if (normalized === null) {
                    return false;
                }
                return normalized >= min && normalized <= max;
            }
            case COMPARE.GT:
            case COMPARE.LT:
            case COMPARE.GTE:
            case COMPARE.LTE: {
                const [cmp] = compare;
                const normalized = this._normalizeToNumber(value);
                if (normalized === null) {
                    return false;
                }
                return this._numberComparison(op, cmp, normalized);
            }
            default:
                return true;
        }
    }

    _numberComparison (op, cmp, normalized) {
        switch (op) {
            case COMPARE.GT:
                return normalized > cmp;
            case COMPARE.LT:
                return normalized < cmp;
            case COMPARE.GTE:
                return normalized >= cmp;
            case COMPARE.LTE:
                return normalized <= cmp;
            default:
                return false;
        }
    }

    /**
     *
     * @param {AIRequest} req
     * @param {RegexpComparator[]} regexps
     * @returns {boolean}
     */
    _matchRegexp (req, regexps) {
        if (regexps.length !== 0) {
            const match = regexps.some(({ r, t }) => {
                if (t) {
                    return req.text(true).match(r);
                }
                return req.text().match(r);
            });

            if (match) {
                return true;
            }
        }
        return false;
    }

}

module.exports = AiMatching;
