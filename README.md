# Kade POS

Point of sale for small shops. English and Sinhala UI, owner PIN lock, installable as a PWA.
Data lives in your own Firebase project (Firestore) and is cached on each device, so selling keeps working offline
and syncs when the connection returns.

## Features

- Sell screen: search, barcode scanner input, discount, tax, cash/card/transfer, change, hold and resume, 80mm receipt printing
- Products: stock tracking, low-stock alerts, CSV import and export
- Sales history with void (restocks items)
- Reports: sales, profit, best sellers, payment methods
- Email and password sign-in. Every device signed in to the same account shares one shop
- Owner PIN: cashiers can sell and view sales, owner pages need the PIN, auto-lock after 5 minutes
- Offline selling with automatic sync. Two tills selling the same item offline combine their stock changes correctly
- Backup and restore as a JSON file

## Set up Firebase

1. Create a project at https://console.firebase.google.com.
2. Authentication: turn on the Email/Password sign-in method.
3. Firestore Database: create a database (production mode), then publish `firestore.rules`.
4. Project settings: add a Web app, copy its config.
5. Copy `.env.example` to `.env` and fill in the four values.

```
npm install
npm run dev        # local
npm run build      # production build in dist/
```

Deploy (optional, Firebase Hosting):

```
npx firebase-tools login
npx firebase-tools use <your-project-id>
npm run build
npx firebase-tools deploy
```

The free Spark plan (about 50,000 reads and 20,000 writes per day) is enough for a small shop.

## How it works

- Data is stored under `shops/{uid}/...` and the rules only let that user read or write it.
- Writes land in the local cache first, so the UI never waits for the network.
- Stock changes use Firestore `increment()`, so concurrent sales on different devices add up instead of overwriting.
- Each device numbers its own receipts (date, a 2-character device code, a counter), so receipt numbers never clash offline.

## Notes

- The PIN is stored hashed (SHA-256 with a salt) in the shop settings. It keeps cashiers out of owner pages, but
  the Firebase account is the real security boundary: anyone signed in to it can read the shop's data.
- Restoring or erasing all data needs an internet connection.
- Sinhala strings are in `src/lib/si.ts`. English text is the key, so add a language by adding another dictionary.
