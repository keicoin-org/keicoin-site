::: details Capture provenance — illustration, not runtime evidence

The revision this was captured from was never recorded, so the state on screen
cannot be re-created. Under the
[screenshot evidence contract](/guide/security#screenshot-evidence) that makes it
an illustration of the running app and not proof of anything. What proves these
pages is the source they embed and the commands printed beside it.

| Field | Recorded |
| --- | --- |
| File | `docs/public/img/docs/button-gameplay.png`, 1600 × 900 PNG |
| Integrity | `sha256sum docs/public/img/docs/button-gameplay.png` → `c6d0eb231cf02b1e0329fbb8e83f9d324fb4e80c380212208fc9a4f38807123d` |
| Repository | [`keicoin-org/button`](https://github.com/keicoin-org/button) |
| Revision at capture | **Not recorded.** The capture cannot be reproduced. |
| Command or URL | `bun run dev`, then `http://localhost:7777` |
| Network or mock mode | Mock. Button's dev server serves an in-memory node at `/rpc` from the same process; nothing on it survives the process. |
| Viewport | **Not recorded.** The stored image is 1600 × 900; the browser and device pixel ratio it was taken at are unknown. |
| Scenario state | **Not recorded.** The issuer seed is generated per run unless `KEI_GAME_SEED` is set, so the asset ids and balances behind this screen differ on every start. |
| Alt text | "Local Button game showing the green button, reward counter, NPC shop board, shopkeeper, and targets" |
| Added to this site | `4ed6462`, 3 August 2026 |
| Last reviewed | 5 August 2026 |
| Stale-proof owner | The `keicoin-org/keicoin-site` maintainers. Replacing it means capturing again from a pinned revision and filling every row above; a row that stays **Not recorded** keeps the image an illustration. |

:::
