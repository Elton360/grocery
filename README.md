# Grocery

This project compares grocery prices per unit across Aldi, Walmart and Costco.

1. **Gather:** the Chrome side panel grabs orders, carts and receipts into a local backend as *pending* items.
2. **Converge:** Claude proposes how pending items join the curated product list, and you approve them.
3. **Normalize:** Claude browses the stores to fill in missing store versions, and you approve them.
4. **Compare:** the web app shows each product's best version per store and the cheapest store.

## Layout
```
backend/     Node (ESM) + Express 5 + better-sqlite3. API, compare math, converge/normalize, CLIs
frontend/    React 19 + Vite web app: Compare, List (pending / on list / ignored), Review (proposals)
extension/   Chrome MV3 side panel (React + Vite → extension/dist) + injected grabbers (extension/public/grabbers)
shared/      code used by frontend and extension: API client, Costco receipt parser, formatting, theme tokens
data/        local only (gitignored): grocery.db (the live database) + converge/ and normalize/ run files
backups/     local only (gitignored): dated snapshots, e.g. 2026-09-28 DB + JSON exports + pre-refactor tarball
archive/     local only (gitignored): retired python-backend, extension-v1, seed-pipeline, old runs, tools
.claude/skills/{converge,normalize}   Claude Code skills that drive phases 2 and 3
```
Each package has its own `package.json` and ESLint config, following `../homelab-dashboard`. Prettier is configured at the root.

## Run
```bash
npm run install:all      # once: root + backend + frontend + extension
npm start                # build the web app, then serve API + app on http://127.0.0.1:8765
```
- **Development:**
  - `npm --prefix backend run dev` runs the API with `node --watch`.
  - `npm --prefix frontend run dev` serves the app on http://localhost:5173 and proxies `/api` to the backend.
- **Checks:**
  - `npm test` runs the backend tests;
  - `npm run lint` runs ESLint in each package;
  - `npm run format` (or `format:check`) runs Prettier.
- **Scope:** the backend only listens on 127.0.0.1. POSTs must carry the `X-Grocery-Client: 1` header, which the app and extension send. Once the backend is hosted, it will need real auth.
- **Database:** `data/grocery.db`, or set `GROCERY_DB` to override the path. Schema and additive migrations are applied at startup (`backend/src/db.js`).
- **Old URLs:** `/`, `/pending(.html)` and `/converge(.html)` redirect to the new pages.

## Extension (side panel)
1. Build it with `npm --prefix extension run build`, or `npm --prefix extension run dev` to rebuild on change.
2. Go to `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and pick **`extension/dist`**. Press reload on the card after each rebuild.
3. Click the toolbar icon to open the side panel. The panel follows the active tab.

| Site | Actions |
|---|---|
| Walmart | **Grab order** on an order detail page; **Grab cart** on walmart.com/cart |
| Instacart (Costco) | **Grab cart** with the cart panel open |
| Aldi | **Grab list** in **In-Store** mode with the list open. The grabber refuses Pickup/Delivery, whose prices run about 10–13% higher |
| Any tab | **Paste Costco receipt**: lines like `E 123456 KS EGGS 2DZ 5.29 N //note` |

**The flow in the panel (no new tabs):**
- A grab opens a review with:
  - the order date;
  - a banner for items already on the list, pending or ignored (collapsed, with a restore option for ignored ones);
  - the new items, with keep checkboxes.
- Unchecked items are removed **and remembered** as ignored.
- **Submit** saves and shows "Saved: …" inline. Move to the next order and grab again.
- An unsubmitted review survives tab switches and closing or reopening the panel (it's kept in `chrome.storage.session`).
- If the backend is down, the rows stay and Submit can be retried.
- The Compare, List and Review links open the web app in a tab only when clicked.

**Duplicates:**
- Re-submitting the same order replaces the earlier grab. Orders are matched by page URL; Costco receipts by date plus item numbers.
- Carts are never deduplicated.

**Grabbers:**
- They run in the page's MAIN world. Instacart and Aldi product IDs come from React fiber props.
- **Backend URL:** `extension/src/config.js`, plus `host_permissions` in `extension/public/manifest.json`.

## Converge (pending → products)
- **Start a run:** press **Converge** on the List page, or run `/converge` in a Claude Code session in this folder.
  - The button runs headless Claude Code with your Claude Code login, so there's no API key or separate bill:
    `claude -p "/converge" --allowedTools "Bash(node backend/bin/converge.js:*)" Read "Edit(./data/converge/**)"`
  - Only one run happens at a time, with a 10-minute timeout. Logs go to `data/converge/run-*.log`.
- **Steps the skill follows:**
  1. `node backend/bin/converge.js export` writes `data/converge/batch-*.json` (pending items, products, pairing candidates, rules).
  2. Claude writes a `proposals-*.json` file.
  3. `node backend/bin/converge.js apply <file>` validates and stores the proposals.
- **Proposal actions:**
  - `link`: another version of an existing product;
  - `new`: a new product;
  - `pair`: a Costco receipt line ↔ an Instacart listing, via `items.pair_id`;
  - `ignore`;
  - `ask`: needs you.
- **Reviewing:** on the **Review** page, approve, edit or reject each proposal, or use **Approve all ≥ 90%**, which skips "needs you".
  - Rejected items stay pending.
  - The agent never writes to the list directly.
- **Rules (also in the export):**
  - milk must be ultra-filtered;
  - eggs must be at least cage-free;
  - otherwise the cheapest acceptable equivalent wins;
  - different product types stay separate.

## Normalize (fill missing store versions)
- **Run:** `/normalize <costco|aldi|walmart|all> [N|all]` in a Claude Code session. It browses in your Chrome, waits about 5 s between searches, and stops on a 403 or captcha.
- **Steps:**
  1. `node backend/bin/normalize.js export --store aldi --limit 10` builds the queue: products with no version at that store and no `not_carried` entry, most-bought first.
  2. Claude searches the store and picks the cheapest acceptable match.
  3. `node backend/bin/normalize.js apply <file>` runs every 5 products.
- **Proposal kinds:**
  - `version`: a new store item, with up to 2 alternatives;
  - `not_carried`;
  - `version_ask`.

  They're reviewed on the same Review page, where radio buttons choose the main find, an alternative, or "not carried".

## Compare rules
- **Costco headline:** the Instacart regular price ÷ the live median markup.
  - The markup comes from Instacart ↔ Costco receipt pairs, about ×1.10.
  - A paired receipt price is shown as "store confirmed" while it's 30 days old or less.
  - The est. badge clears when the confirmed price is within 5% and $5 of the estimate.
- **Compare unit (per product):** per count when every version has a pack count (sheets first for paper goods); otherwise the most common unit. Versions in any other unit show "units differ".
- **Each store cell** shows its best version (`preferred` first, then cheapest per unit), plus "+N more versions".
- **Aldi pickup prices** (`grabs.price_mode = 'pickup'`) never count as prices.
- **Where the math lives:** `backend/src/lib/metrics.js` (sizes and units) and `backend/src/lib/compare.js`.

## Data (`data/grocery.db`)
- `grabs`: one row per submit (store, source, order date, page, `order_key`, `price_mode`).
- `observations`: every item seen in a grab, i.e. the price history.
- `items`: one row per `(store, store_product_id)`:
  - status `pending`, `ignored` or `converged`;
  - `product_id`, `size_text`, `match_tier`, `note`, `preferred`;
  - `pair_id` and `regular_price` for Instacart items.
- `products`: the curated list. `not_carried` records stores that don't carry a product. `proposals` holds converge/normalize proposals and your decisions.

## Tests
- **Test data:** synthetic only. Each test builds a scratch database from `fixtures/seed.sql`: 11 products, about 30 items and 6 grabs, with no real IDs or orders. The header comment in that file maps each product to the rules it exercises. Size and unit-price parsing cases are in `fixtures/sizes.json`.
- **Parity goldens:** the Node port was checked against goldens captured from the retired Python backend by `archive/tools/capture_goldens.py` (local only):
  - every read API and CLI export;
  - `measure()` on every seed item and size case;
  - a scripted scenario (`fixtures/scenario.json`) of grabs, dedupe, ignore, converge and normalize apply/approve/reject, compared down to the final database state.

## Backlog (not scheduled)
- **UI design:** the pages and side panel have a plain placeholder look until the design brief arrives.
- **Past-order grabbers:**
  - Instacart needs an example past-order page.
  - Aldi needs a signed-in order page, or a receipt paste like Costco's if Aldi is shopped in store.
- **Hosted backend:** add real auth, and point the extension's `BACKEND` and `host_permissions` at the server. Then replace the headless Claude Code trigger with a Claude API call using the same export and proposal schema; that needs an API key, a spend cap and a billing decision first.
