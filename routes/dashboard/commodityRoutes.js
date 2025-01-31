const router = require("express").Router();
const { model } = require("mongoose");
const { authMiddleware } = require("../../middlewares/authMiddleware");

const commodityController = require("../../controllers/dashboard/commodityController");

router.post("/commodity-add", authMiddleware, commodityController.add_commodity);
// router.get("/category-get", authMiddleware, commodityController.get_category);


// router.delete("/category-remove/:id", authMiddleware, commodityController.delete_category);
// router.delete("/feature-remove/:id", authMiddleware, commodityController.deleteAdditionalFeature);

module.exports = router;
