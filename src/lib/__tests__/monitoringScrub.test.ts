import { redactSensitive, redactSensitiveText, scrubBreadcrumb } from '@/lib/monitoringScrub';

describe('redactSensitiveText', () => {
  it('masque la ligne recopiée par une violation de CHECK', () => {
    const detail = 'Failing row contains (5f1c…, expense, 12500, Loyer (juin), 2026-06-01, null).';
    expect(redactSensitiveText(detail)).toBe('Failing row contains ([filtré]).');
  });

  it("masque les valeurs d'une violation d'unicité ou de clé étrangère", () => {
    expect(
      redactSensitiveText('Key (user_id, lower(name))=(abc, ali (cousin)) already exists.'),
    ).toBe('Key (user_id, lower(name))=([filtré]) already exists.');
    expect(
      redactSensitiveText('Key (category_id)=(9a7e) is not present in table "categories".'),
    ).toBe('Key (category_id)=([filtré]) is not present in table "categories".');
  });

  it('laisse intact un message sans valeur', () => {
    const message = 'new row violates row-level security policy for table "transactions"';
    expect(redactSensitiveText(message)).toBe(message);
  });
});

describe('redactSensitive', () => {
  it("nettoie toutes les chaînes d'un événement sans modifier l'original", () => {
    const event = {
      message: 'upsert refusé',
      exception: { values: [{ type: 'Error', value: 'Failing row contains (1, 300)' }] },
      extra: { details: ['Failing row contains (note privée)'], code: 23514 },
    };
    const scrubbed = redactSensitive(event);
    expect(scrubbed).toEqual({
      message: 'upsert refusé',
      exception: { values: [{ type: 'Error', value: 'Failing row contains ([filtré])' }] },
      extra: { details: ['Failing row contains ([filtré])'], code: 23514 },
    });
    expect(event.exception.values[0].value).toBe('Failing row contains (1, 300)');
  });
});

describe('scrubBreadcrumb', () => {
  it('écarte les breadcrumbs console', () => {
    expect(scrubBreadcrumb({ category: 'console', message: '[sync] échec' })).toBeNull();
  });

  it('nettoie les autres breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'http', message: 'Failing row contains (42)' })).toEqual({
      category: 'http',
      message: 'Failing row contains ([filtré])',
    });
  });
});
