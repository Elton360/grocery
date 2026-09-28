-- Synthetic test data (no real purchases, ids or order numbers). Loaded on top of the schema by the tests
-- (test/helpers.js) and by archive/tools/capture_goldens.py. Each product exercises specific compare rules:
--
--   1 Eggs            per-count compare; Costco receipt↔Instacart pair (markup); Aldi pickup price ignored
--   2 Milk            Instacart promo with regular_price column; fl oz; Aldi not carried
--   3 Salmon          weighed pair (About N lb + receipt weight_lb); Walmart sold by weight with "was $"
--   4 Paper towels    sheets beat counts; Aldi not carried
--   5 Frozen waffles  "X oz, N Count" ambiguity resolved by the store unit price; per count with alt_ppu
--   6 Bagels          old unpaired Costco receipt (stale); pair whose receipt is excluded from the markup
--   7 Tortillas       two Aldi versions, preferred first; Walmart version in other units ("units differ")
--   8 Water           Aldi item with only a pickup observation falls back to last_price
--   9 Bananas         name-keyed Walmart item (no store id); Aldi version never bought (normalize "match")
--  10 Dinner rolls    Walmart only; Aldi not carried → in the Costco normalize queue
--  11 Plantain chips  Walmart only; open normalize proposal for Aldi
--
-- Plus pending items (for converge), ignored items and a few decided/open proposals.

INSERT INTO products (id, name, category, created_at) VALUES
  (1, 'Eggs', 'dairy', '2026-09-01T10:00:00'),
  (2, 'Milk', 'dairy', '2026-09-01T10:00:00'),
  (3, 'Salmon', 'meat/seafood', '2026-09-01T10:00:00'),
  (4, 'Paper towels', 'household', '2026-09-01T10:00:00'),
  (5, 'Frozen waffles', 'frozen', '2026-09-01T10:00:00'),
  (6, 'Bagels', 'bakery', '2026-09-01T10:00:00'),
  (7, 'Tortillas', 'bakery', '2026-09-01T10:00:00'),
  (8, 'Water', 'pantry', '2026-09-01T10:00:00'),
  (9, 'Bananas', 'produce', '2026-09-01T10:00:00'),
  (10, 'Dinner rolls', 'bakery', '2026-09-01T10:00:00'),
  (11, 'Plantain chips', 'snacks', '2026-09-01T10:00:00');

INSERT INTO grabs (id, store, source, order_date, captured_at, page_url, order_key, price_mode) VALUES
  (1, 'walmart', 'order', '2026-09-20', '2026-09-20T12:00:00', 'https://www.walmart.com/orders/TEST-ORDER-1', 'walmart:https://www.walmart.com/orders/TEST-ORDER-1', 'online'),
  (2, 'costco', 'receipt', '2026-09-18', '2026-09-18T12:00:00', '', 'costco:receipt:2026-09-18:test00000001', 'in_store'),
  (3, 'instacart', 'cart', '2026-09-19', '2026-09-19T12:00:00', 'https://www.instacart.com/store/costco/cart', NULL, 'online'),
  (4, 'aldi', 'cart', '2026-09-21', '2026-09-21T12:00:00', 'https://www.aldi.us/store/aldi/storefront', NULL, 'pickup'),
  (5, 'aldi', 'cart', '2026-09-22', '2026-09-22T12:00:00', 'https://www.aldi.us/store/aldi/storefront', NULL, 'in_store'),
  (6, 'costco', 'receipt', '2026-07-01', '2026-07-01T12:00:00', '', 'costco:receipt:2026-07-01:test00000002', 'in_store');

INSERT INTO items (store, store_product_id, name, size_text, url, first_seen, last_seen, times_seen, last_price,
                   last_source, status, product_id, weight_lb, pair_id, regular_price, match_tier, note,
                   exclude_markup, preferred) VALUES
  -- 1 Eggs
  ('instacart', 'ic-eggs-24', 'Kirkland Signature Cage-Free Eggs, 24-count', NULL, 'https://example.test/ic-eggs-24', '2026-09-19', '2026-09-19', 1, 8.49, 'cart', 'converged', 1, NULL, 'cc-eggs', NULL, 'exact', NULL, 0, 0),
  ('costco', 'cc-eggs', 'KS CF 2DZ', '24-count', NULL, '2026-09-18', '2026-09-18', 1, 7.79, 'receipt', 'converged', 1, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  ('walmart', 'wm-eggs-18', 'Great Value Cage-Free Large Eggs, 18 Count', NULL, 'https://example.test/wm-eggs-18', '2026-09-20', '2026-09-20', 1, 4.47, 'order', 'converged', 1, NULL, NULL, NULL, 'equivalent', NULL, 0, 0),
  ('aldi', 'al-eggs-12', 'Goldhen Cage Free Eggs, 12 ct', NULL, 'https://example.test/al-eggs-12', '2026-09-21', '2026-09-22', 2, 2.79, 'cart', 'converged', 1, NULL, NULL, NULL, 'equivalent', 'in-store price', 0, 0),
  -- 2 Milk
  ('instacart', 'ic-milk', 'Kirkland Signature Ultra-Filtered 2% Milk, 52 fl oz, 3-count', NULL, NULL, '2026-09-19', '2026-09-19', 1, 12.49, 'cart', 'converged', 2, NULL, 'cc-milk', 13.49, 'exact', NULL, 0, 0),
  ('costco', 'cc-milk', 'KS UF 2% MILK', '52 fl oz, 3-count', NULL, '2026-09-18', '2026-09-18', 1, 12.29, 'receipt', 'converged', 2, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  ('walmart', 'wm-milk', 'fairlife Ultra-Filtered 2% Milk, 52 fl oz', NULL, NULL, '2026-09-20', '2026-09-20', 1, 4.28, 'order', 'converged', 2, NULL, NULL, NULL, 'equivalent', NULL, 0, 0),
  -- 3 Salmon
  ('instacart', 'ic-salmon', 'Kirkland Signature Atlantic Salmon Fillet (About 3 lb / package)', NULL, NULL, '2026-09-19', '2026-09-19', 1, 38.97, 'cart', 'converged', 3, NULL, 'cc-salmon', NULL, 'exact', NULL, 0, 0),
  ('costco', 'cc-salmon', 'KS ATL SALMON', NULL, NULL, '2026-09-18', '2026-09-18', 1, 29.97, 'receipt', 'converged', 3, 2.5, NULL, NULL, 'exact', NULL, 0, 0),
  ('walmart', 'wm-salmon', 'Fresh Atlantic Salmon Fillet', NULL, NULL, '2026-09-20', '2026-09-20', 1, 11.62, 'order', 'converged', 3, NULL, NULL, NULL, 'equivalent', NULL, 0, 0),
  -- 4 Paper towels
  ('instacart', 'ic-towels', 'Kirkland Signature Paper Towels, 12 rolls', '160 Sheets, 12 Rolls', NULL, '2026-09-19', '2026-09-19', 1, 24.99, 'cart', 'converged', 4, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  ('walmart', 'wm-towels', 'Bounty Select-A-Size Paper Towels, 6 Double Rolls', '98 Sheets, 6 Rolls', NULL, '2026-09-20', '2026-09-20', 1, 15.97, 'order', 'converged', 4, NULL, NULL, NULL, 'equivalent', NULL, 0, 0),
  -- 5 Frozen waffles
  ('instacart', 'ic-waffles', 'Kellogg''s Eggo Homestyle Waffle, 1.24 oz, 60-count', NULL, NULL, '2026-09-19', '2026-09-19', 1, 13.08, 'cart', 'converged', 5, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  ('walmart', 'wm-waffles', 'Eggo Homestyle Waffles, 12.3 oz, 10 Count', NULL, NULL, '2026-09-20', '2026-09-20', 1, 3.47, 'order', 'converged', 5, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  -- 6 Bagels
  ('costco', 'cc-bagels', 'KS BAGELS 12CT', '12-count', NULL, '2026-07-01', '2026-07-01', 1, 6.49, 'receipt', 'converged', 6, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  ('instacart', 'ic-bagels', 'Kirkland Signature Bagels, 12-count', NULL, NULL, '2026-09-19', '2026-09-19', 1, 7.29, 'cart', 'converged', 6, NULL, 'cc-bagels-sale', 7.29, 'exact', NULL, 0, 0),
  ('costco', 'cc-bagels-sale', 'KS BAGELS SALE', '12-count', NULL, '2026-09-18', '2026-09-18', 1, 4.99, 'receipt', 'converged', 6, NULL, NULL, NULL, 'exact', 'instant savings', 1, 0),
  ('aldi', 'al-bagels', 'L''oven Fresh Plain Bagels, 6 ct', NULL, NULL, '2026-09-22', '2026-09-22', 1, 1.99, 'cart', 'converged', 6, NULL, NULL, NULL, 'equivalent', NULL, 0, 0),
  -- 7 Tortillas
  ('aldi', 'al-tort-carb', 'L''oven Fresh Carb Control Tortillas, 8 ct', NULL, NULL, '2026-09-22', '2026-09-22', 1, 3.39, 'cart', 'converged', 7, NULL, NULL, NULL, 'exact', NULL, 0, 1),
  ('aldi', 'al-tort-flour', 'Casa Mamita Flour Tortillas, 10 ct', NULL, NULL, '2026-09-22', '2026-09-22', 1, 2.49, 'cart', 'converged', 7, NULL, NULL, NULL, 'substitute', 'not low-carb', 0, 0),
  ('walmart', 'wm-tort', 'Mission Carb Balance Tortillas', NULL, NULL, '2026-09-20', '2026-09-20', 1, 4.28, 'order', 'converged', 7, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  -- 8 Water
  ('aldi', 'al-water', 'Puraqua Water, 40 pack', '16.9 fl oz, 40-count', NULL, '2026-09-21', '2026-09-21', 1, 4.99, 'match', 'converged', 8, NULL, NULL, NULL, 'equivalent', 'in-store price', 0, 0),
  ('walmart', 'wm-water', 'Great Value Purified Water, 16.9 fl oz, 40 Count', NULL, NULL, '2026-09-20', '2026-09-20', 1, 4.98, 'order', 'converged', 8, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  -- 9 Bananas
  ('walmart', 'name:bananas', 'Bananas', NULL, NULL, '2026-09-20', '2026-09-20', 1, 1.25, 'order', 'converged', 9, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  ('aldi', 'al-bananas', 'Bananas, per lb', '1 lb', 'https://example.test/al-bananas', NULL, '2026-09-22', 0, 0.49, 'match', 'converged', 9, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  -- 10 Dinner rolls, 11 Plantain chips
  ('walmart', 'wm-rolls', 'Great Value Dinner Rolls, 12 Count', NULL, NULL, '2026-09-20', '2026-09-20', 1, 2.47, 'order', 'converged', 10, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  ('walmart', 'wm-chips', 'Mariquitas Plantain Chips, 5 oz', NULL, NULL, '2026-09-20', '2026-09-20', 1, 1.78, 'order', 'converged', 11, NULL, NULL, NULL, 'exact', NULL, 0, 0),
  -- pending (for converge)
  ('walmart', 'wm-new-beans', 'Great Value Black Beans, 15 oz', NULL, NULL, '2026-09-20', '2026-09-20', 1, 0.98, 'order', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  ('costco', 'cc-new-oil', 'KS ORG EVOO 2L', NULL, NULL, '2026-09-18', '2026-09-18', 1, 16.99, 'receipt', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  ('instacart', 'ic-new-oil', 'Kirkland Signature Organic Extra Virgin Olive Oil, 2 L', NULL, NULL, '2026-09-19', '2026-09-19', 1, 17.99, 'cart', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  -- ignored
  ('walmart', 'wm-ign-card', 'Birthday Card', NULL, NULL, '2026-09-20', '2026-09-20', 1, 3.97, 'order', 'ignored', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  ('aldi', 'al-ign-cream', 'Friendly Farms Heavy Whipping Cream (32 fl oz)', NULL, NULL, '2026-09-22', '2026-09-22', 1, 4.29, 'cart', 'ignored', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0);

INSERT INTO observations (grab_id, store, store_product_id, name, size_text, qty, price_each, line_total,
                          unit_price_text, notes, raw_json) VALUES
  (1, 'walmart', 'wm-eggs-18', 'Great Value Cage-Free Large Eggs, 18 Count', NULL, 1, 4.47, 4.47, '24.8¢/ea', '', NULL),
  (1, 'walmart', 'wm-milk', 'fairlife Ultra-Filtered 2% Milk, 52 fl oz', NULL, 2, 4.28, 8.56, '8.2¢/fl oz', '', NULL),
  (1, 'walmart', 'wm-salmon', 'Fresh Atlantic Salmon Fillet', NULL, 1, 11.62, 11.62, '$9.97/lb', 'was $12.46', NULL),
  (1, 'walmart', 'wm-towels', 'Bounty Select-A-Size Paper Towels, 6 Double Rolls', NULL, 1, 15.97, 15.97, '', '', NULL),
  (1, 'walmart', 'wm-waffles', 'Eggo Homestyle Waffles, 12.3 oz, 10 Count', NULL, 1, 3.47, 3.47, '28.2¢/oz', '', NULL),
  (1, 'walmart', 'wm-tort', 'Mission Carb Balance Tortillas', NULL, 1, 4.28, 4.28, '', '', NULL),
  (1, 'walmart', 'wm-water', 'Great Value Purified Water, 16.9 fl oz, 40 Count', NULL, 1, 4.98, 4.98, '0.7¢/fl oz', '', NULL),
  (1, 'walmart', 'name:bananas', 'Bananas', NULL, 1, 1.25, 1.25, '$0.62/lb', 'was $1.40', NULL),
  (1, 'walmart', 'wm-rolls', 'Great Value Dinner Rolls, 12 Count', NULL, 1, 2.47, 2.47, '', '', NULL),
  (1, 'walmart', 'wm-chips', 'Mariquitas Plantain Chips, 5 oz', NULL, 1, 1.78, 1.78, '35.6¢/oz', '', NULL),
  (1, 'walmart', 'wm-new-beans', 'Great Value Black Beans, 15 oz', NULL, 1, 0.98, 0.98, '6.5¢/oz', '', NULL),
  (1, 'walmart', 'wm-ign-card', 'Birthday Card', NULL, 1, 3.97, 3.97, '', '', NULL),
  (2, 'costco', 'cc-eggs', 'KS CF 2DZ', NULL, 1, 7.79, 7.79, NULL, '', '{"taxable": false}'),
  (2, 'costco', 'cc-milk', 'KS UF 2% MILK', NULL, 1, 12.29, 12.29, NULL, '', '{"taxable": false}'),
  (2, 'costco', 'cc-salmon', 'KS ATL SALMON', NULL, 1, 29.97, 29.97, NULL, '2.5 lb', '{"taxable": false}'),
  (2, 'costco', 'cc-bagels-sale', 'KS BAGELS SALE', NULL, 1, 4.99, 4.99, NULL, 'instant savings', '{"taxable": false}'),
  (2, 'costco', 'cc-new-oil', 'KS ORG EVOO 2L', NULL, 1, 16.99, 16.99, NULL, '', '{"taxable": false}'),
  (3, 'instacart', 'ic-eggs-24', 'Kirkland Signature Cage-Free Eggs, 24-count', NULL, 1, 8.49, 8.49, NULL, '', '{"original_price": 8.49}'),
  (3, 'instacart', 'ic-milk', 'Kirkland Signature Ultra-Filtered 2% Milk, 52 fl oz, 3-count', NULL, 1, 12.49, 12.49, NULL, 'promo $12.49 (was $13.49)', '{"original_price": 13.49}'),
  (3, 'instacart', 'ic-salmon', 'Kirkland Signature Atlantic Salmon Fillet (About 3 lb / package)', NULL, 1, 38.97, 38.97, NULL, '', '{"original_price": 38.97}'),
  (3, 'instacart', 'ic-towels', 'Kirkland Signature Paper Towels, 12 rolls', NULL, 1, 24.99, 24.99, NULL, '', NULL),
  (3, 'instacart', 'ic-waffles', 'Kellogg''s Eggo Homestyle Waffle, 1.24 oz, 60-count', NULL, 1, 11.99, 11.99, NULL, 'promo $11.99 (was $13.08)', '{"original_price": 13.08}'),
  (3, 'instacart', 'ic-bagels', 'Kirkland Signature Bagels, 12-count', NULL, 1, 7.29, 7.29, NULL, '', NULL),
  (3, 'instacart', 'ic-new-oil', 'Kirkland Signature Organic Extra Virgin Olive Oil, 2 L', NULL, 1, 17.99, 17.99, NULL, '', '{"original_price": 17.99}'),
  (4, 'aldi', 'al-eggs-12', 'Goldhen Cage Free Eggs, 12 ct', NULL, 1, 3.15, 3.15, NULL, '', NULL),
  (4, 'aldi', 'al-water', 'Puraqua Water, 40 pack', NULL, 1, 5.65, 5.65, NULL, '', NULL),
  (5, 'aldi', 'al-eggs-12', 'Goldhen Cage Free Eggs, 12 ct', NULL, 1, 2.79, 2.79, NULL, '', NULL),
  (5, 'aldi', 'al-bagels', 'L''oven Fresh Plain Bagels, 6 ct', NULL, 1, 1.99, 1.99, NULL, '', NULL),
  (5, 'aldi', 'al-tort-carb', 'L''oven Fresh Carb Control Tortillas, 8 ct', NULL, 1, 3.39, 3.39, NULL, '', NULL),
  (5, 'aldi', 'al-tort-flour', 'Casa Mamita Flour Tortillas, 10 ct', NULL, 1, 2.49, 2.49, NULL, '', NULL),
  (5, 'aldi', 'al-ign-cream', 'Friendly Farms Heavy Whipping Cream (32 fl oz)', NULL, 1, 4.29, 4.29, NULL, '', NULL),
  (6, 'costco', 'cc-bagels', 'KS BAGELS 12CT', NULL, 1, 6.49, 6.49, NULL, '', '{"taxable": false}');

INSERT INTO not_carried (product_id, store, note, checked_on) VALUES
  (2, 'aldi', 'no ultra-filtered milk', '2026-09-22'),
  (4, 'aldi', 'only single rolls', '2026-09-22'),
  (10, 'aldi', 'no dinner rolls', '2026-09-22');

INSERT INTO proposals (id, batch, store, store_product_id, action, payload_json, confidence, reason, status,
                       created_at, decided_at) VALUES
  (1, 'SEED1', 'walmart', 'wm-eggs-18', 'link',
   '{"store": "walmart", "store_product_id": "wm-eggs-18", "action": "link", "confidence": 0.95, "reason": "same eggs", "size_text": null, "match_tier": "equivalent", "note": null, "preferred": false, "product_id": 1}',
   0.95, 'same eggs', 'approved', '2026-09-20T13:00:00', '2026-09-20T14:00:00'),
  (2, 'SEED1', 'walmart', 'wm-new-beans', 'new',
   '{"store": "walmart", "store_product_id": "wm-new-beans", "action": "new", "confidence": 0.6, "reason": "beans", "size_text": null, "match_tier": null, "note": null, "preferred": false, "new_product": {"name": "Black beans", "category": "pantry"}}',
   0.6, 'beans', 'rejected', '2026-09-20T13:00:00', '2026-09-20T14:00:00'),
  (3, 'SEED2', 'aldi', 'al-chips', 'version',
   '{"action": "version", "product_id": 11, "product_name": "Plantain chips", "target": "aldi", "item_store": "aldi", "confidence": 0.8, "reason": "only plantain chips", "match_tier": "equivalent", "note": "in-store price", "checked_on": "2026-09-22", "store_product_id": "al-chips", "name": "Mariquitas Original Plantain Chips", "url": "https://example.test/al-chips", "price": 2.75, "size_text": "5 oz", "alternatives": []}',
   0.8, 'only plantain chips', 'proposed', '2026-09-22T13:00:00', NULL),
  (4, 'SEED1', 'costco', 'cc-new-oil', 'ask',
   '{"store": "costco", "store_product_id": "cc-new-oil", "action": "ask", "confidence": 0.3, "reason": "unsure", "size_text": null, "match_tier": null, "note": null, "preferred": false, "candidates": [2]}',
   0.3, 'unsure', 'superseded', '2026-09-20T13:00:00', '2026-09-20T14:00:00');
