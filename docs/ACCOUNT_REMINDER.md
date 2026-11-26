# Guest Account Reminder

The reminder is a prompt, not a gate: the library stays rendered, and the
game the visitor chose waits in `pendingLaunch` until they sign in, create an
account, continue as a guest, or close the dialog.

## Two dismissal scopes

| Choice | Storage | Scope |
| --- | --- | --- |
| Close the dialog (Escape or the overlay) | `sessionStorage` key `geegle-account-reminder-dismissed` | Rest of the browsing session; a later session asks again |
| **Continue as guest** without the checkbox | same `sessionStorage` key | Rest of the browsing session |
| **Continue as guest** with **Don't remind me again** checked | `localStorage` key `geegle-account-reminder-off` | Persists across reloads, new tabs and browser restarts, with no account |

The checkbox is unchecked on every open. It is never preselected, and the
permanent preference is written **only** when the visitor chooses Continue as
guest with it checked. Closing the dialog never writes the permanent key.

`reminderSuppressed()` is true when either key is set. Signed-in users never
see the reminder at all (`shouldShowAccountReminder` returns false when
`userId` exists), and proxy launches keep their separate safety notice.

## Reset

Settings → Preferences → **Reset account reminder** clears both keys, so the
next guest launch asks again. The action is enabled only while the reminder is
actually suppressed. The library disclaimer and the proxy safety notice have
independent preferences and are not affected.

## Browser storage

A guest's preference is local to this browser profile. Completely clearing
site data (cookies and site storage) removes both keys and the reminder can
appear again. Geegle does not require an account to store the preference and
does not send it to the server.

## Verification

`scripts/qa/check-guest-reminder-preference.mjs` drives the built app through
14 checks: unchecked-by-default, session-only dismissal, a new session asking
again, the permanent choice surviving reload and a new tab, the reset action,
and clearing storage restoring the reminder. Unit guards live in
`tests/account-reminder.test.mjs`.
