import { FunctionComponent } from "react";
import Layout, {props} from "./layout.js";


const Login: FunctionComponent<props> = (props) => {
  return <Layout {...props}>
    <form autoComplete="off" action={`/interaction/${props.uid}/login`} method="post">
      <input required type="text" name="login" placeholder="Enter any login" autoFocus={!props.params.login_hint} defaultValue={props.params.login_hint as string} />
      <input required type="password" name="password" placeholder="and password" autoFocus={!!props.params.login_hint} />

      <button type="submit" className="login login-submit">Sign-in</button>
    </form>
  </Layout>
}

export default Login


