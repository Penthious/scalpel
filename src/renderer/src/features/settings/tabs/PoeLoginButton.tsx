import { useAuth } from '@renderer/shared/use-auth'
import { m } from '@shared/paraglide/messages.js'

export function PoeLoginButton(): JSX.Element {
  const { auth, login, logout } = useAuth()

  if (auth === null) return <span className="text-[11px] text-text-dim">{m.common_checking()}</span>

  if (auth.loggedIn) {
    return (
      <div className="setting-box">
        <span className="value text-accent">{m.settings_pc_logged_in_as({ account: auth.accountName })}</span>
        <button
          className="text-[11px] text-text-dim shrink-0 ml-2 px-3 py-[5px]"
          onClick={() => {
            logout()
          }}
        >
          {m.common_logout()}
        </button>
      </div>
    )
  }

  return (
    <div className="setting-box">
      <span className="value text-text-dim">{m.settings_pc_not_logged_in()}</span>
      <button
        className="primary"
        onClick={() => {
          login()
        }}
      >
        {m.common_login()}
      </button>
    </div>
  )
}
