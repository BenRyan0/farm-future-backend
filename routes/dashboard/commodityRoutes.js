const router = require("express").Router();
const { model } = require("mongoose");
const { authMiddleware } = require("../../middlewares/authMiddleware");

const commodityController = require("../../controllers/dashboard/commodityController");

router.post("/commodity-add", authMiddleware, commodityController.add_commodity);
router.get("/commodity-get", authMiddleware, commodityController.get_commodities);
router.get("/commodity-get-1", authMiddleware, commodityController.get_commodities_1);

router.post("/admin-commodity-price-add", authMiddleware, commodityController.add_commodity_price);

router.delete("/commodity-remove/:id", authMiddleware, commodityController.delete_commodity);

router.get("/commodity-statistics/:id", authMiddleware, commodityController.get_commodity_data);
// router.delete("/category-remove/:id", authMiddleware, commodityController.delete_category);
// router.delete("/feature-remove/:id", authMiddleware, commodityController.deleteAdditionalFeature);

module.exports = router;
