import { nanoid } from "nanoid";
import {
  AccountClaims,
  Account,
  ClaimsParameterMember,
  FindAccount,
} from "oidc-provider";

const store = new Map();
const logins = new Map();

export const make_account = (
  account_id: string,
  profile?: AccountClaims
): Account => {
  // TODO: Find information about the user via the address (account_id)
  const accountId = account_id || nanoid();
  return {
    accountId,
    profile,
    claims: async (
      _use: string,
      scope: string,
      _claims: { [key: string]: null | ClaimsParameterMember },
      _rejected: string[]
    ): Promise<AccountClaims> => {
      console.log(scope);
      if (profile) {
        return {
          sub: accountId, // it is essential to always return a sub claim
          email: profile.email,
          email_verified: profile.email_verified,
          family_name: profile.family_name,
          given_name: profile.given_name,
          locale: profile.locale,
          name: profile.name,
        };
      }

      return {
        sub: accountId, // it is essential to always return a sub claim

        address: {
          country: "000",
          formatted: "000",
          locality: "000",
          postal_code: "000",
          region: "000",
          street_address: "000",
        },
        birthdate: "1987-10-16",
        email: "johndoe@example.com",
        email_verified: false,
        family_name: "Doe",
        gender: "male",
        given_name: "John",
        locale: "en-US",
        middle_name: "Middle",
        name: "John Doe",
        nickname: "Johny",
        phone_number: "+49 000 000000",
        phone_number_verified: false,
        picture: "http://lorempixel.com/400/200/",
        preferred_username: "johnny",
        profile: "https://johnswebsite.com",
        updated_at: 1454704946,
        website: "http://example.com",
        zoneinfo: "Europe/Berlin",
      };
    },
  };
};

export const find_account: FindAccount = (ctx, sub, token) => {
  // eslint-disable-line no-unused-vars
  // token is a reference to the token used for which a given account is being loaded,
  //   it is undefined in scenarios where account claims are returned from authorization endpoint
  // ctx is the koa request context
  if (!store.get(sub)) make_account(sub); // eslint-disable-line no-new
  return store.get(sub);
};

export const findByLogin = (login: string): Account => {
  if (!logins.get(login)) {
    logins.set(login, make_account(login));
  }

  return logins.get(login);
};
