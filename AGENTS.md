<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Data access uses the browser client + RLS/security-definer RPCs; contact columns (phone/address/birth_date) are column-revoked and read only via `view_contact` (audited) or `my_contact` — why: restrict PII to authorized admins.
- First signup becomes owner admin via `handle_new_user` trigger — why: bootstraps admin without manual SQL.

- Announcements use a public `announcements` table with authenticated approved-member reads and admin-only writes enforced by RLS — why: the member board stays live while publishing remains restricted.
