import { isSameEmail, wrongAccountMessage } from '@/features/auth/reauth';

describe('isSameEmail', () => {
  it('ignore la casse et les espaces autour', () => {
    expect(isSameEmail(' Compte@Gmail.com ', 'compte@gmail.com')).toBe(true);
  });

  it('distingue deux adresses différentes', () => {
    expect(isSameEmail('compte@gmail.com', 'autre@gmail.com')).toBe(false);
  });
});

describe('wrongAccountMessage', () => {
  it('rappelle l’adresse du compte attendu', () => {
    expect(wrongAccountMessage('compte@gmail.com')).toBe(
      'Ce n’est pas le bon compte. Choisis compte@gmail.com.',
    );
  });

  it('sans adresse connue, message générique', () => {
    expect(wrongAccountMessage(null)).toContain('première connexion');
  });
});
