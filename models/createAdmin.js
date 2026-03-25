import 'dotenv/config';
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "./Admin.js";

const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://LantaXpress_db:LantaXpress123@lantaxpress.gt65dpj.mongodb.net/?appName=LantaXpress";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@lantaxpress.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@1234";

const createAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URL);

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const existingAdmin = await Admin.findOne({ email: ADMIN_EMAIL });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit();
    }

    await Admin.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Admin created successfully");
    console.log(`Temporary admin credentials -> email: ${ADMIN_EMAIL} password: ${ADMIN_PASSWORD}`);
    console.log('Please change the admin password from the admin dashboard as soon as possible.');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

createAdmin();