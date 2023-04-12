/* eslint-disable no-console, camelcase, no-unused-vars */
import { strict as assert } from "node:assert";
import * as querystring from "node:querystring";
import { inspect } from "node:util";

import isEmpty from "lodash/isEmpty.js";
import { koaBody as bodyParser } from "koa-body";
import Router from "koa-router";

import * as Account from "../support/account.js";
import Provider, { InteractionResults, KoaContextWithOIDC, errors } from "oidc-provider"; // from 'oidc-provider';
import config from "../support/configuration.js";

import Interaction from "../views/interaction.js";
import { renderToStaticMarkup } from "react-dom/server";
import Login from "../views/login.js";

const keys = new Set();
const debug = (obj: Object) =>
  querystring.stringify(
    Object.entries(obj).reduce((acc: Record<string, string>, [key, value]) => {
      keys.add(key);
      if (isEmpty(value)) return acc;
      acc[key] = inspect(value, { depth: null });
      return acc;
    }, {}),
    "<br/>",
    ": ",
    {
      encodeURIComponent(value) {
        return keys.has(value) ? `<strong>${value}</strong>` : value;
      },
    }
  );

const get_grant = async (
  provider: Provider,
  accountId: string,
  client_id: string,
  grantId?: string
) => {
  if (grantId) {
    // we'll be modifying existing grant in existing session
    const grant = await provider.Grant.find(grantId);
    if (grant != null) return grant;
  }

  // we're establishing a new grant
  return new provider.Grant({
    accountId,
    clientId: client_id,
  });
};

const { SessionNotFound } = errors;

export default (provider: Provider) => {
  const router = new Router();

  router.use(async (ctx, next) => {
    ctx.set("cache-control", "no-store");
    try {
      await next();
    } catch (err) {
      if (err instanceof SessionNotFound) {
        ctx.status = err.status;
        const { message: error, error_description } = err;
        await (config as any).renderError(ctx as any as KoaContextWithOIDC, { error, error_description }, err);
      } else {
        throw err;
      }
    }
  });

  router.get("/interaction/:uid", async (ctx, next) => {
    const { uid, prompt, params, session } = await provider.interactionDetails(
      ctx.req,
      ctx.res
    );
    const client = await provider.Client.find(params.client_id as string);

    console.log({prompt, params, client});

    switch (prompt.name) {
      case "login": {
        console.log("login");
        const body = renderToStaticMarkup(
          <Login
          client={client as any}
          uid={uid}
          details={prompt.details as any}
          params={params as any}
          title="Sign-in"
          session={session ? debug(session) : undefined}
          dbg={{
            params: debug(params),
            prompt: debug(prompt),
          }} />
        );
        ctx.body = body;
        return;
      }
      case "consent": {
        console.log("consent");
        const body = renderToStaticMarkup(
          <Interaction
            client={client as any}
            uid={uid}
            details={prompt.details as any}
            params={params as any}
            title="Authorize"
            session={session ? debug(session) : undefined}
            dbg={{
              params: debug(params),
              prompt: debug(prompt),
            }}
          />
        );
        ctx.body = body;
        return;
      }
      default:
        return next();
    }
  });

  const body = bodyParser({
    text: false,
    json: false,
    patchNode: true,
    patchKoa: true,
  });

  type login_submission = {
    login: string;
    password: string;
  };

  router.post("/interaction/:uid/login", body, async (ctx) => {
    const {
      prompt: { name },
    } = await provider.interactionDetails(ctx.req, ctx.res);
    assert.equal(name, "login");

    const body: login_submission = ctx.request.body;

    const account = await Account.findByLogin(body.login);

    console.log(account);

    const result = {
      login: {
        accountId: account.accountId,
      },
    };

    console.log(result);

    return provider.interactionFinished(ctx.req, ctx.res, result, {
      mergeWithLastSubmission: false,
    });
  });

  router.post("/interaction/:uid/confirm", body, async (ctx) => {
    console.log("confirm");
    const interactionDetails = await provider.interactionDetails(
      ctx.req,
      ctx.res
    );
    const {
      prompt: { name, details },
      params,
      session,
    } = interactionDetails;
    console.log(interactionDetails);
    const accountId = session!.accountId;
    assert.equal(name, "consent");

    let { grantId } = interactionDetails;
    const grant = await get_grant(provider, accountId, params.client_id as string, grantId);

    if (details.missingOIDCScope) {
      grant.addOIDCScope((details.missingOIDCScope as string[]).join(" "));
    }
    if (details.missingOIDCClaims) {
      grant.addOIDCClaims(details.missingOIDCClaims as string[]);
    }
    if (details.missingResourceScopes) {
      for (const [indicator, scope] of Object.entries(
        details.missingResourceScopes
      )) {
        grant.addResourceScope(indicator, scope.join(" "));
      }
    }

    grantId = await grant.save();

    const consent: {
      grantId?: string | undefined;
      [key: string]: unknown;
    } = {};
    if (!interactionDetails.grantId) {
      // we don't have to pass grantId to consent, we're just modifying existing one
      consent.grantId = grantId;
    }

    const result: InteractionResults = { consent };
    return provider.interactionFinished(ctx.req, ctx.res, result, {
      mergeWithLastSubmission: true,
    });
  });

  router.get("/interaction/:uid/abort", async (ctx) => {
    const result = {
      error: "access_denied",
      error_description: "End-User aborted interaction",
    };

    return provider.interactionFinished(ctx.req, ctx.res, result, {
      mergeWithLastSubmission: false,
    });
  });

  return router;
};
