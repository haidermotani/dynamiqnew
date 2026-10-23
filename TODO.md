# DYNAMIQ launch TODO

This site is complete as a working template. Everything below must be reviewed and replaced with real business information before launch. Items still written as `{{REPLACE: ...}}` are intentionally unresolved.

## Before launch

- [ ] Buy or confirm the production domain and update `SITE_URL` in `src/config.js`.
- [ ] Replace the generated `yourdomain.example` value in `public/CNAME` by rebuilding after setting `SITE_URL`.
- [ ] Replace the owner story on the home page.
- [ ] Add the real Instagram, Facebook, and TikTok profile URLs in `src/config.js`.
- [ ] Add the registered legal business name.
- [ ] Add a monitored contact email and business address.
- [ ] Confirm the WhatsApp number `0339 0012879` and test it from a phone.
- [ ] Replace all four sample products with real products, categories, sizes, prices, and photos.
- [ ] Add real front and back photos for each product, or leave the generated grey placeholder tiles.
- [ ] Add real size guide measurements to `src/data/size-guide.json`. Keep the file as `[]` to hide the size guide.
- [ ] Answer the delivery and returns questions in `src/data/faqs.json`, or leave the answers as `null` to hide those questions.
- [ ] Replace the delivery, returns and refunds, and jurisdiction placeholders in `terms.html`.
- [ ] Review both legal pages and set the correct effective date.
- [ ] Run `npm run check` and complete a manual phone test before launch.
- [ ] Confirm the hosting provider serves `404.html` for unknown routes.

## Placeholder values

| Placeholder | File | Replace with |
| --- | --- | --- |
| `{{REPLACE: https://yourdomain}}` | `src/config.js` | The final HTTPS site URL, without a trailing slash |
| `{{REPLACE: Instagram profile URL}}` | `src/config.js` | The real Instagram profile URL |
| `{{REPLACE: Facebook page URL}}` | `src/config.js` | The real Facebook page URL |
| `{{REPLACE: TikTok profile URL}}` | `src/config.js` | The real TikTok profile URL |
| `{{REPLACE: legal business name}}` | `src/config.js` | The registered business or owner name |
| `{{REPLACE: owner's story}}` | `index.html` | A short, factual owner introduction |
| `{{REPLACE: contact email}}` | `privacy.html` | A monitored contact email |
| `{{REPLACE: business address}}` | `privacy.html` | The business postal address |
| `{{REPLACE: delivery policy}}` | `terms.html` | The real delivery terms |
| `{{REPLACE: return and refund policy}}` | `terms.html` | The real returns and refunds terms |
| `{{REPLACE: confirm jurisdiction}}` | `terms.html` | The governing law and jurisdiction |

## Product photos

Add source photos to `IMAGES/` using the product ID and view in the filename. For example, for product `sample-01`, use `sample-01-front.jpg` and `sample-01-back.jpg`. The build script matches the product ID or product slug plus `front` or `back`, then writes 1000x1250 WebP files to `public/assets/products/`.

When real products replace the samples, update `src/data/products.json` first, then add the matching photos. Unmatched photos are listed below by the build script.

## Unmatched product photos

<!-- AUTO:UNMATCHED-PHOTOS:START -->
None.
<!-- AUTO:UNMATCHED-PHOTOS:END -->
