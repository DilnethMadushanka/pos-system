# Kade POS

Offline-first point of sale for small shops. English and Sinhala UI, owner PIN lock, installable as a PWA.
All data is stored in the browser (IndexedDB), so there is no server or monthly cost.

## Features

- Sell screen: search, barcode scanner input, discount, tax, cash/card/transfer, change, hold and resume, 80mm receipt printing
- Products: stock tracking, low-stock alerts, CSV import and export
- Sales history with void (restocks items)
- Reports: sales, profit, best sellers, payment methods
- Owner PIN: cashiers can sell and view sales, owner pages need the PIN, auto-lock after 5 minutes
- Backup and restore as a JSON file

## Develop

```
npm install
npm run dev
npm run build
```

## Notes

- The PIN is stored hashed (SHA-256 with a salt) on the device. It keeps cashiers out of owner pages, but it is not
  a defence against someone with full access to the device's browser data.
- Add a language by extending `src/lib/si.ts`-style dictionaries and `src/lib/i18n.ts`.
