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
- Notification categories use persisted kinds for events and live weekly RPC results for absence/missing-preparation alerts — why: event history stays auditable while weekly status never becomes stale.
- Servant attendance is self-recorded once per Cairo week and is the sole source for servant absence reports — why: attendance should reflect presence rather than inferred activity.
- Staff-added members are profile-only rows (no login) created via `staff_add_member`; yearly promotion runs via pg_cron `promote_academic_years` and graduates 3rd-year members to status 'graduated' — why: servants can track children without accounts, and history is archived rather than deleted.
