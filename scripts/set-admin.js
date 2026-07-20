// Run locally after installing firebase-admin:
// node scripts/set-admin.js your-admin-email@example.com
const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const email = process.argv[2];
if (!email) throw new Error("Pass the admin email.");

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`Admin claim added to ${email}. Log out and log in again.`);
  process.exit(0);
})();