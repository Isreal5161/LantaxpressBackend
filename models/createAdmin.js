import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "./models/createAdmin";

const MONGO_URL = "mongodb+srv://LantaXpress_db:LantaXpress123@lantaxpress.gt65dpj.mongodb.net/?appName=LantaXpress";

const createAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URL);

    const hashedPassword = await bcrypt.hash("Admin@1234", 12);

    const existingAdmin = await Admin.findOne({ email: "admin@lantaxpress.com" });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit();
    }

    await Admin.create({
      email: "admin@lantaxpress.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Admin created successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

createAdmin();