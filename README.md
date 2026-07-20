# ZERO_CRAFTLABB / Batman Cap

A single-product cinematic landing page for ZERO_CRAFTLABB Drop 001.

## Stack

- HTML / CSS / JavaScript
- Three.js OBJLoader for the `.obj` product model
- Firebase Firestore + Firebase Auth
- Razorpay international online payments
- Vercel serverless API
- GitHub

## 1. Add your assets

Rename your real product images to:

```text
assets/product/cap-front.jpg
assets/product/cap-back.jpg
assets/product/cap-top.jpg
assets/product/cap-inside.jpg
```

Put your 3D model here:

```text
assets/3d/cap.obj
```

If your OBJ depends on an `.mtl` file/textures, this starter intentionally uses a dark material in JavaScript. If you want the original OBJ materials, we can add MTLLoader and the texture files.

## 2. Firebase

Create a Firebase project and a Web App.

Enable:

- Firestore Database
- Authentication → Email/Password

Copy the Web App config into:

```text
js/firebase-config.js
```

Create a Firestore document:

```text
products/batman-cap
```

with:

```json
{
  "stock": 50
}
```

Deploy the rules:

```bash
firebase deploy --only firestore:rules
```

## 3. Admin account

Create an Email/Password user in Firebase Authentication.

Download a Firebase Admin service account key and save it locally as:

```text
serviceAccountKey.json
```

Then run:

```bash
node scripts/set-admin.js your-email@example.com
```

Delete the service account file from your project after use.

## 4. Razorpay

This project uses Razorpay for the online checkout.

Because the product price is $50, the API creates a USD order for 5000 cents per cap.

You need international payments enabled on your Razorpay account.

Add these environment variables in Vercel:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Use test keys first.

## 5. Run

```bash
npm install
npm run dev
```

## 6. Deploy

Push the project to GitHub and import the repository into Vercel.

Add the same environment variables in:

Vercel → Project → Settings → Environment Variables

## Important

The public Firebase config is safe to use in the frontend. Never put:

- Razorpay secret
- Firebase Admin private key

inside frontend JavaScript.
