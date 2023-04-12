import { promisify } from "node:util";

import helmet from "helmet";
import mount from "koa-mount";

import Provider from "oidc-provider";

import configuration from "./support/configuration.js";
import routes from "./routes/koa.js";
import { resolve } from "node:path";

const { PORT = 3000, ISSUER = `http://localhost:${PORT}` } = process.env;

let server;

try {
  const prod = process.env.NODE_ENV === "production";

  const provider = new Provider(ISSUER, configuration);

  const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
  delete directives["form-action"];
  const pHelmet = promisify(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives,
      },
    })
  );

  // Some hack for helmet
  provider.use(async (ctx, next) => {
    const origSecure = (ctx.req as any).secure;
    (ctx.req as any).secure = ctx.request.secure;
    await pHelmet(ctx.req, ctx.res);
    (ctx.req as any).secure = origSecure;
    return next();
  });

  const static_path = resolve("./packages/frontend/build");
  console.log({ static_path });

  if (prod) {
    provider.proxy = true;
    provider.use(async (ctx, next) => {
      if (ctx.secure) {
        await next();
      } else if (ctx.method === "GET" || ctx.method === "HEAD") {
        ctx.status = 303;
        ctx.redirect(ctx.href.replace(/^http:\/\//i, "https://"));
      } else {
        ctx.body = {
          error: "invalid_request",
          error_description: "do yourself a favor and only use https",
        };
        ctx.status = 400;
      }
    });
  }
  provider.use(routes(provider).routes());
  server = provider.listen(PORT, () => {
    console.log(
      `application is listening on port ${PORT}, check its /.well-known/openid-configuration`
    );
  });
} catch (err) {
  if (server?.listening) server.close();
  console.error(err);
  process.exitCode = 1;
}
