// backend/routes/profileRoutes.js
const express = require("express");
const router = express.Router();
const User = require("./user");
const authMiddleware = require("../middleware/authMiddleware");

// === GET PROFILE ===
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("❌ GET PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
});

// === UPDATE PROFILE ===
router.put("/", authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { name, avatar },
      { new: true }
    ).select("-password");
    res.json({ user: updated });
  } catch (err) {
    console.error("❌ UPDATE PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error while updating profile" });
  }
});

module.exports = router;
