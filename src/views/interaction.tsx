import { FunctionComponent } from "react";
import Layout, {props} from "./layout.js";

const Interaction: FunctionComponent<props> = (props) => {
  const missingOIDCScope =
    (props.details.missingOIDCScope || [])
    .filter(scope => scope !== "openid" && scope !== "offline_access");
  const missingOIDCClaims =
    (props.details.missingOIDCScope || [])
    .filter(claim => !['sub', 'sid', 'auth_time', 'acr', 'amr', 'iss'].includes(claim));

  const show_consent = [
    props.details.missingOIDCScope,
    props.details.missingOIDCClaims,
    props.details.missingResourceScopes,
  ].filter(Boolean).length === 0;

  return <Layout {...props}>
    <div className="login-client-image">
      { props.client.logoUri ? <img src={props.client.logoUri} /> : null }
    </div>

    <ul>
      { show_consent
      ? <li>the client is asking you to confirm previously given authorization</li>
      : null
      }

      { missingOIDCScope.length > 0
      ? <>
          <li>scopes:</li>
          <ul>
            {missingOIDCScope.map((scope) => (
              <li>{ scope }</li>
            ))}
          </ul>
        </>
      : null
      }

      { missingOIDCClaims.length > 0
      ? <>
          <li>claims:</li>
          <ul>
            {missingOIDCClaims.map((claim) => (
              <li>{ claim }</li>
            ))}
          </ul>
        </>
      : null
      }

      { props.params.scope && (props.params.scope as string[]).includes('offline_access')
      ? <li> the client is asking to have offline access to this authorization
            { (!props.details.missingOIDCScope) || !props.details.missingOIDCScope.includes('offline_access')
            ? "(which you've previously granted)"
            : null }
        </li>
      : null
      }
    </ul>

    <form autoComplete="off" action={`/interaction/${props.uid}/confirm`} method="post">
      <button autoFocus type="submit" className="login login-submit">Continue</button>
    </form>
  </Layout>;
}

export default Interaction;
