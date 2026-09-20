import { describe, expect, it } from 'vitest';
import { matchMerchant, normalizeMerchant, displayMerchant } from './merchant';
import { parseExpiry, parseOffer, parseOfferScreen } from './parseOffer';

describe('normalizeMerchant', () => {
  it('strips payment processor prefixes', () => {
    expect(normalizeMerchant('SQ *SWEETGREEN #1234')).toBe('sweetgreen');
    expect(normalizeMerchant('TST* Shake Shack')).toBe('shake shack');
    expect(normalizeMerchant('PAYPAL *ETSY')).toBe('etsy');
  });

  it('strips domains and store numbers', () => {
    expect(normalizeMerchant('sweetgreen.com')).toBe('sweetgreen');
    expect(normalizeMerchant('www.nordstrom.com')).toBe('nordstrom');
    expect(normalizeMerchant('TARGET #2841')).toBe('target');
  });

  it('resolves brands to one canonical key through aliases', () => {
    expect(normalizeMerchant('THE HOME DEPOT #6177')).toBe('home depot');
    expect(normalizeMerchant('HomeDepot.com')).toBe('home depot');
    expect(normalizeMerchant('Whole Foods Mkt')).toBe('whole foods');
  });

  it('drops corporate-form noise but keeps the brand', () => {
    expect(normalizeMerchant('Peloton Interactive Inc')).toBe('peloton interactive');
    expect(normalizeMerchant('Instacart LLC')).toBe('instacart');
  });
});

describe('matchMerchant', () => {
  it('matches the same store across issuer descriptor styles', () => {
    expect(matchMerchant('SQ *SWEETGREEN #1234', 'sweetgreen.com').matches).toBe(true);
    expect(matchMerchant('THE HOME DEPOT #6177', 'HomeDepot.com').matches).toBe(true);
  });

  it('matches a location-qualified store name', () => {
    expect(matchMerchant('Sweetgreen', 'Sweetgreen Downtown Crossing').matches).toBe(true);
  });

  it('survives a single OCR character error', () => {
    // The exact regression the edit-distance tier exists for: bigram overlap
    // alone scores ~0.78 here, under the 0.82 threshold.
    expect(matchMerchant('Sweetgneen', 'Sweetgreen').matches).toBe(true);
    expect(matchMerchant('Panora', 'Panera').matches).toBe(true);
  });

  it('does not merge a parent brand with a distinct sub-brand', () => {
    expect(matchMerchant('Uber', 'Uber Eats').matches).toBe(false);
    expect(matchMerchant('Amazon', 'Amazon Fresh').matches).toBe(false);
  });

  it('does not match on a short shared prefix', () => {
    expect(matchMerchant('BP', 'BPM Fitness').matches).toBe(false);
  });

  it('does not merge visually similar but unrelated brands', () => {
    expect(matchMerchant('Lowes', 'Loews').matches).toBe(false);
  });

  it('title-cases for display', () => {
    expect(displayMerchant('SQ *SHAKE SHACK #22')).toBe('Shake Shack');
  });
});

describe('parseOffer - Amex phrasings', () => {
  it('parses spend-threshold offers', () => {
    const o = parseOffer('Spend $100 or more, get $25 back', 'Sweetgreen');
    expect(o.kind).toBe('spend_get');
    expect(o.minSpend).toBe(100);
    expect(o.amountBack).toBe(25);
    expect(o.merchant).toBe('sweetgreen');
  });

  it('parses the compact + form', () => {
    const o = parseOffer('Spend $50+, get $10 back');
    expect(o.minSpend).toBe(50);
    expect(o.amountBack).toBe(10);
  });

  it('parses percent offers with a cap', () => {
    const o = parseOffer('Get 10% back on purchases, up to a total of $30');
    expect(o.kind).toBe('percent');
    expect(o.percentBack).toBe(10);
    expect(o.maxBack).toBe(30);
  });

  it('parses points-denominated offers', () => {
    const o = parseOffer('Spend $200 or more, get 5,000 Membership Rewards® points');
    expect(o.kind).toBe('points');
    expect(o.minSpend).toBe(200);
    expect(o.pointsBack).toBe(5000);
  });

  it('parses a reversed-order first-purchase offer', () => {
    const o = parseOffer('Get $50 back on your first purchase of $250 or more');
    expect(o.kind).toBe('spend_get');
    expect(o.amountBack).toBe(50);
    expect(o.minSpend).toBe(250);
  });
});

describe('parseOffer - other issuers', () => {
  it('parses Chase compact forms', () => {
    const a = parseOffer('$5 back on $25+');
    expect(a.amountBack).toBe(5);
    expect(a.minSpend).toBe(25);

    const b = parseOffer('15% back, up to $30');
    expect(b.percentBack).toBe(15);
    expect(b.maxBack).toBe(30);

    const c = parseOffer('$10 back on purchases of $50 or more');
    expect(c.amountBack).toBe(10);
    expect(c.minSpend).toBe(50);
  });

  it('parses Capital One forms', () => {
    expect(parseOffer('5% off').percentBack).toBe(5);

    const o = parseOffer('$10 off $50');
    expect(o.amountBack).toBe(10);
    expect(o.minSpend).toBe(50);
  });

  it('parses Bank of America and Citi forms', () => {
    const boa = parseOffer('10% cash back, up to $15');
    expect(boa.percentBack).toBe(10);
    expect(boa.maxBack).toBe(15);

    const citi = parseOffer('Spend $75, get $15 back');
    expect(citi.minSpend).toBe(75);
    expect(citi.amountBack).toBe(15);
  });

  it('handles decimal amounts without truncating at the decimal point', () => {
    const o = parseOffer('Spend $100.00 or more, get $25.50 back');
    expect(o.minSpend).toBe(100);
    expect(o.amountBack).toBe(25.5);
  });

  it('flags a payout larger than its own threshold as low confidence', () => {
    const o = parseOffer('Spend $10, get $500 back');
    expect(o.confidence).toBeLessThanOrEqual(0.4);
  });
});

describe('parseExpiry', () => {
  const now = new Date('2026-09-20T12:00:00Z');

  it('parses explicit numeric dates', () => {
    expect(parseExpiry('Expires 12/31/25', now)).toBe('2025-12-31');
    expect(parseExpiry('Expires 03/15/2027', now)).toBe('2027-03-15');
  });

  it('parses named month dates', () => {
    expect(parseExpiry('Valid through Dec 31, 2026', now)).toBe('2026-12-31');
  });

  it('rolls a bare month/day forward rather than into the past', () => {
    // Scanned in September; a January deadline belongs to next year.
    expect(parseExpiry('Ends 1/15', now)).toBe('2027-01-15');
    expect(parseExpiry('Ends 11/30', now)).toBe('2026-11-30');
  });

  it('parses relative expiry', () => {
    expect(parseExpiry('Expires in 5 days', now)).toBe('2026-09-25');
  });
});

describe('parseOfferScreen', () => {
  it('splits a screenshot of an offers list into separate offers', () => {
    const screen = [
      'Sweetgreen',
      'Spend $25 or more, get $5 back',
      'Expires 11/30/26',
      'Shake Shack',
      'Get 10% back on purchases, up to a total of $20',
      'Expires 12/15/26',
      'Delta Air Lines',
      'Spend $200 or more, get 5,000 points',
    ].join('\n');

    const offers = parseOfferScreen(screen, new Date('2026-09-20T12:00:00Z'));
    expect(offers).toHaveLength(3);

    expect(offers[0].merchant).toBe('sweetgreen');
    expect(offers[0].minSpend).toBe(25);
    expect(offers[0].amountBack).toBe(5);
    expect(offers[0].expiresAt).toBe('2026-11-30');

    expect(offers[1].merchant).toBe('shake shack');
    expect(offers[1].percentBack).toBe(10);
    expect(offers[1].maxBack).toBe(20);

    expect(offers[2].merchant).toBe('delta');
    expect(offers[2].pointsBack).toBe(5000);
  });
});
