const { Schema, model } = require("mongoose");
const AdminCommodityPriceSchema = new Schema({
    commodity: { type: Schema.Types.ObjectId, ref: "Commodity", required: true },
    price: { type: Number, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "admins", required: true }, // Admin ID
    week: { type: String, required: true }, // ISO Week format, e.g., "2025-W05"
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = model("AdminCommodityPrice", AdminCommodityPriceSchema);
  