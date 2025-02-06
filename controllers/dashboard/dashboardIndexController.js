

const AdminCommodityPrice = require('../../models/Commodity/adminCommodityPriceModel')
const Commodity = require('../../models/Commodity/commodityModel')

const { mongo: { ObjectId } } = require('mongoose')
const { responseReturn } = require('../../utils/response')



module.exports.get_commodity_chart_data = async (req, res) => {
  const { commodityId } = req.params;

  try {
    // Find the commodity by ID
    const commodity = await Commodity.findById(commodityId);
    if (!commodity) {
      return res.status(404).json({ error: "Commodity not found." });
    }

    // Fetch and aggregate data for the specific commodity
    const data = await AdminCommodityPrice.aggregate([
      {
        $match: { commodity: commodity._id }, // Match the specific commodity by ID
      },
      {
        $group: {
          _id: "$week",
          averagePrice: { $avg: "$price" },
        },
      },
      {
        $sort: { _id: 1 }, // Sort by week
      },
    ]);

    const formattedData = {
      name: commodity.name,
      data: data.map((entry) => ({
        week: entry._id,
        price: entry.averagePrice,
      })),
    };

    res.json(formattedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data." });
  }

};