// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("./user");
const authMiddleware = require("./middleware/authMiddleware"); 

// === SIGNUP ===
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 1️⃣ Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 2️⃣ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3️⃣ Create new user (password will be hashed by pre-save hook in User model)
    const newUser = new User({ email, password, name: name || "Anonymous" });
    await newUser.save();

    // 4️⃣ Generate token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Signup successful",
      token,
      user: { id: newUser._id, email: newUser.email, name: newUser.name },
    });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({
      message: "Server error during signup",
      error: err.message,
    });
  }
});

// === LOGIN ===
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 2️⃣ Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 3️⃣ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // 4️⃣ Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({
      message: "Server error during login",
      error: err.message,
    });
  }
});

// === GET CURRENT USER ===
router.get("/me", authMiddleware, async (req, res) => {
  try {
    return res.json({
      user: req.user,
      message: "Authenticated successfully",
    });
  } catch (err) {
    console.error("❌ /me route error:", err);
    res.status(500).json({ message: "Server error fetching user info" });
  }
});

module.exports = router;
