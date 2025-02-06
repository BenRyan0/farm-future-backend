const mongoose = require('mongoose');

const commoditySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    category: { type: String, required: true },
    unit: { type: String, required: true },
    image: {
        type: String,
        required: true,
      },
    createdAt: { type: Date, default: Date.now }
},
{ timestamps: true }

);

commoditySchema.index({
    name: "text",
  });

// Create and export the model
module.exports = mongoose.model('Commodity', commoditySchema);
