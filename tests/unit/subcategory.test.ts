import { describe, expect, it } from 'vitest';
import { groupLine, subcategory } from '../../packages/core/subcategory.ts';

const none = { tier: null, source: 'rules', signal: '' } as const;
const acct = (name: string, key: string, quote = '') => ({ name, key, exists: { ...none, quote }, money: none, work: none, reset: none, sso: none });

describe('groups inside a line', () => {
  it('sorts money into kinds', () => {
    expect(subcategory(acct('Harbourline Bank', 'harbourline.example', 'Your October statement is ready'), 'money')).toBe('Banks and payments');
    expect(subcategory(acct('Kestrel Mutual', 'kestrelmutual.example', 'Your annual statement for life policy'), 'money')).toBe('Insurance');
    expect(subcategory(acct('Oakmere Pensions', 'oakmere-pensions.example'), 'money')).toBe('Pensions and investments');
    expect(subcategory(acct('Brightwell Energy', 'brightwell-energy.example', 'Your bill is ready'), 'money')).toBe('Bills and utilities');
    expect(subcategory(acct('Reelhouse', 'reelhouse.example', 'Your subscription renewed'), 'money')).toBe('Subscriptions');
    expect(subcategory(acct('Shop', 'shop.example', 'Your refund is on its way'), 'money')).toBe('Other money');
  });
  it('sorts other accounts into shopping, social and the rest', () => {
    expect(subcategory(acct('Larkspur Books', 'larkspur-books.example', 'Order confirmation'), 'rest')).toBe('Shopping');
    expect(subcategory(acct('Thornfield Garden Club', 'thornfield-gardens.example'), 'rest')).toBe('Social and community');
    expect(subcategory(acct('Zed', 'zed.example'), 'rest')).toBe('Other sites');
  });
  it('shows banks before bills, keeps list order inside a group, and leaves a one-group line unnamed', () => {
    const a = acct('A Bank', 'a.example'), b = acct('B Energy', 'b.example', 'bill'), c = acct('C Bank', 'c.example');
    expect(groupLine([b, a, c], 'money').map((g) => [g.label, g.items.map((i) => i.name)]))
      .toEqual([['Banks and payments', ['A Bank', 'C Bank']], ['Bills and utilities', ['B Energy']]]);
    expect(groupLine([a, c], 'money')).toEqual([{ label: '', items: [a, c] }]);
    expect(groupLine([a], 'sso')).toEqual([{ label: '', items: [a] }]);
  });
});
