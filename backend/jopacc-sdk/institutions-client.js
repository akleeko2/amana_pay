/**
 * Amana Pay — Mock Financial Institutions Client
 * -----------------------------------------------------------------------------
 * يحاكي: GET /institution
 * يرجع institutionType + institutionIdentification (BIC) + name + روابط HATEOAS.
 */
'use strict';

const store = require('./_store');
const jades = require('./jades-client');
const { buildHeaders, errors } = require('./_helpers');

/** GET /institution — معلومات مؤسسة بنكية حسب الـ BIC (افتراضياً الأولى). */
async function getInstitution(bic, opts = {}) {
  const bank = bic ? store.getBankByBic(bic) : store.banks[0];
  if (!bank) throw errors.notFound(`Institution not found: ${bic}`);

  return {
    headers: buildHeaders({ accessToken: opts.accessToken, jwsSignature: jades.sign({ bic })['x-jws-signature'] }),
    institution: {
      institutionType: 'BANK',
      institutionIdentification: { address: bank.bic, schema: 'bicCode' },
      name: { enName: bank.name.en, arName: bank.name.ar },
      cliqSupported: bank.cliqSupported,
      _links: {
        self: { href: '/institution', method: 'GET' },
        branches: { href: '/institution/branches', method: 'GET' },
        fees: { href: '/institution/fees', method: 'GET' },
        FXs: { href: '/institution/FXs', method: 'GET' },
      },
    },
  };
}

/** قائمة كل البنوك (مساعد للبروتوتايب). */
function listBanks() {
  return store.banks;
}

module.exports = { getInstitution, listBanks };
