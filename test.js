// ติดตั้งก่อน: npm install bcrypt
const bcrypt = require("bcrypt");

async function hashPassword(plainPassword) {
  const saltRounds = 10;
  try {
    const hash = await bcrypt.hash(plainPassword, saltRounds);
    console.log("Hashed password:", hash);
    return hash;
  } catch (err) {
    console.error("Error hashing password:", err);
  }
}

hashPassword("123");
