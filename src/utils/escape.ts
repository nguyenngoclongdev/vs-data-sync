import { EOL } from 'node:os';
import pgp from 'pg-promise';

/**
 * @param { any } value any value
 * @returns { string }
 */
export const escape = (value: any) => {
    if (value === 'NOW()' || value === 'now()') {
        // NOW() returned as-is, so that working with dates is easier
        return value;
    }

    if (value === null) {
        return 'null';
    }

    switch (typeof value) {
        case 'string': {
            const escapeText = pgp.as.text(value);
            const withoutSingleQuote = escapeText.slice(1, -1);
            if (withoutSingleQuote.includes(EOL)) {
                // Transform EOL to char(10). Examples:
                // - 'abc \n def' => CONCAT('abc', chr(10), 'def')
                // - '\n abc \n def' => CONCAT(chr(10), 'abc', chr(10), 'def')
                // - '\n abc \n def \n' => CONCAT(chr(10), 'abc', chr(10), 'def', chr(10))
                const split = withoutSingleQuote.split(EOL).map((current, index, array) => {
                    // If first item is empty => new line (after split) => transform to chr(10)
                    // Otherwise, it is normal text
                    if (index === 0) {
                        if (!current) {
                            return `chr(10)`;
                        } else {
                            return `'${current}', chr(10)`;
                        }
                    }

                    // If last item is empty => new line (after split) => transform to chr(10)
                    // Otherwise, it is normal text (return without include chr(10))
                    if (index === array.length - 1) {
                        if (!current) {
                            return `chr(10)`;
                        } else {
                            return `'${current}'`;
                        }
                    }

                    // The item array (not first/last), add chr(10)
                    return `'${current}', chr(10)`;
                });
                return `CONCAT(${split.join(', ')})`;
            }
            return escapeText;
        }
        case 'boolean': {
            return pgp.as.bool(value);
        }
        case 'number':
        case 'bigint': {
            return pgp.as.number(value);
        }
        case 'symbol': {
            throw new TypeError(`Type Symbol has no meaning for PostgreSQL: ${value.toString()}`);
        }
        default: {
            if (value instanceof Date) {
                return pgp.as.date(value);
            }
            if (value instanceof Array) {
                return pgp.as.array(value);
            }
            if (value instanceof Buffer) {
                return pgp.as.buffer(value);
            }
            return pgp.as.json(value);
        }
    }
};
