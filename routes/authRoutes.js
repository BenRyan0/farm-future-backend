const router = require("express").Router();
const { model } = require("mongoose");
const { authMiddleware } = require("../middlewares/authMiddleware");
const authControllers = require("../controllers/authControllers");

router.post("/admin-login", authControllers.admin_login);
router.put("/admin-change-password", authControllers.change_password);
router.put("/seller-change-password", authControllers.changePassword_Seller);
router.get("/get-user", authMiddleware, authControllers.getUser);

router.post("/seller-register", authControllers.seller_register);
router.post("/seller-login", authControllers.seller_login);


router.post("/profile-image-upload",authMiddleware, authControllers.profile_image_upload);
router.post("/association-image-upload",authMiddleware, authControllers.association_image_upload);


router.get("/logout",authMiddleware, authControllers.logout);


router.post("/trader-register", authControllers.trader_register);

module.exports = router;
