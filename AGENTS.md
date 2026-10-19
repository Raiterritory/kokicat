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

- Keep boss behavior and character-skin rendering in focused modules under `src/lib`; this keeps the canvas route maintainable for APK export.
- Keep the offline APK bundle generated through `bun run build:static` with Capacitor reading `dist-static`; this guarantees local media is packaged.
- Enforce per-viewer player visibility in database RPCs using validated player credentials and a persisted cutoff; never trust client-supplied nicknames or registration dates.
- Keep web-only restrictions (like the daily closed hours) in `src/lib/web-hours.ts`, which detects the Android build first and fails open: the APK must always run.
