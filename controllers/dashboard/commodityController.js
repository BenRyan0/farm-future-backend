const commodityModel = require("../../models/Commodity/commodityModel");
const CommodityModel = require("../../models/Commodity/commodityModel");
const AdminCommodityPriceModel = require("../../models/Commodity/adminCommodityPriceModel");
const { responseReturn } = require("../../utils/response");
const cloudinary = require("cloudinary").v2;
const formidable = require("formidable");
const sharp = require("sharp");
const fs = require("fs");
const { DateTime } = require('luxon');
const mongoose = require('mongoose'); // Import mongoose


const path = require("path");

require("dotenv").config();

class commodityController {
  resizeImage = async (imagePath) => {
    const outputDir = path.join(__dirname, "../../uploads");
    const outputFilePath = path.join(outputDir, "resized_" + path.basename(imagePath));

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await sharp(imagePath).resize(800, 800).toFile(outputFilePath);
    return outputFilePath;
  };


  add_commodity = async (req, res) => {
    if (!req.id) {
      return responseReturn(res, 401, { error: "User not authenticated" });
    }

    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return responseReturn(res, 400, { error: "Form parsing error" });
      }

      let { name, category, unit, description } = fields;
      let { image } = files;

      if (!name || !category || !unit) {
        console.log("DIRI NA")
        return responseReturn(res, 400, {
          error: "Name, category, and unit are required",
        });
      }

      name = name.trim();
      category = category.trim();
      unit = unit.trim();
      if (description) description = description.trim();

      // Check if the commodity already exists
      const existingCommodity = await commodityModel.findOne({ name });
      if (existingCommodity) {
        return responseReturn(res, 409, { error: "Commodity already exists" });
      }

      cloudinary.config({
        cloud_name: process.env.cloud_name,
        api_key: process.env.api_key,
        api_secret: process.env.api_secret,
        secure: true,
      });

      try {
        let imageUrl = null;

        if (image) {
          const resizedImagePath = await this.resizeImage(image.filepath || image.path);
          const result = await cloudinary.uploader.upload(resizedImagePath, {
            folder: "commodities",
            timeout: 60000,
          });

          fs.unlinkSync(resizedImagePath); // Delete temp resized image
          imageUrl = result.url;
        }

        const commodity = await commodityModel.create({
          name,
          category,
          unit,
          description,
          image: imageUrl,
          createdAt: Date.now(),
        });

        return responseReturn(res, 201, {
          commodity,
          message: "Commodity added successfully",
        });
      } catch (error) {
        console.error("Error:", error);
        return responseReturn(res, 500, { error: "Internal server error" });
      }
    });
  };

  delete_commodity = async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return responseReturn(res, 400, { error: "Commodity ID must be provided" });
    }

    try {
      const commodity = await commodityModel.findById(id);
      if (!commodity) {
        return responseReturn(res, 404, { error: "Commodity not found" });
      }

      // Delete the image from Cloudinary
      const imageUrl = commodity.image;
      const publicId = imageUrl.split("/").pop().split(".")[0];

      cloudinary.config({
        cloud_name: process.env.cloud_name,
        api_key: process.env.api_key,
        api_secret: process.env.api_secret,
        secure: true,
      });

      try {
        await cloudinary.uploader.destroy(`commodities/${publicId}`);
      } catch (imageError) {
        console.error("Error deleting image from Cloudinary:", imageError);
      }

      await commodityModel.deleteOne({ _id: commodity._id });

      return responseReturn(res, 200, {
        message: "Commodity deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting commodity:", error);
      return responseReturn(res, 500, { error: "Internal server error" });
    }
  };

  get_commodities_1 = async (req, res) => {
    console.log("Fetching commodities");
  
    const { page, searchValue, parPage } = req.query;
    const pageNum = parseInt(page) || 1; // Default to page 1 if not provided
    const limit = parseInt(parPage) || 10; // Default to 10 items per page if not provided
    const skipPage = limit * (pageNum - 1);
  
    try {
      // Build the query for searching commodities
      let query = {};
      if (searchValue) {
        query = {
          $or: [
            { name: { $regex: searchValue, $options: "i" } }, // Partial match for 'name'
            { $text: { $search: searchValue } }, // Full-text search
          ],
        };
      }
  
      // Fetch commodities with pagination and sorting
      const [commodities, totalCommodities] = await Promise.all([
        CommodityModel.find(query).skip(skipPage).limit(limit).sort({ createdAt: -1 }),
        CommodityModel.countDocuments(query),
      ]);
  
      console.log("Commodities fetched:", commodities);
  
      responseReturn(res, 200, { totalCommodities, commodities });
    } catch (error) {
      console.error(error.message);
      responseReturn(res, 500, { message: "An error occurred while fetching commodities." });
    }
  };
  

get_commodities = async (req, res) => {
  console.log("Commodities");
  console.log(req.query);

  const { page, searchValue, parPage, firstDay, lastDay } = req.query;
  console.log(req.query)
  const pageNum = parseInt(page);
  const limit = parseInt(parPage);
  const skipPage = limit * (pageNum - 1);

  // Convert firstDay and lastDay to Date objects
  const firstDayDate = new Date(firstDay);
  const lastDayDate = new Date(lastDay);

  // Check if the dates are valid
  if (isNaN(firstDayDate.getTime()) || isNaN(lastDayDate.getTime())) {
    return responseReturn(res, 400, { message: "Invalid date format" });
  }

  // Convert to ISO string format (UTC)
  const firstDayUTC = firstDayDate.toISOString();
  const lastDayUTC = lastDayDate.toISOString();

  const week = {
    firstDay: firstDayUTC,
    lastDay: lastDayUTC
  };

  console.log(week);

  try {
    // Parse the 'week' range (directly using the dates)
    let startDate, endDate;
    if (week) {
      startDate = new Date(week.firstDay);
      endDate = new Date(week.lastDay);
    }

    // Calculate the weekString using Luxon (for the first day of the week)
    const firstDayDateLuxon = DateTime.fromISO(week.firstDay);

    // Format month (e.g., "2025-February")
    const month = firstDayDateLuxon.toFormat('yyyy-MMMM');

    // Calculate the week number in the month (using firstDay)
    const startOfMonth = firstDayDateLuxon.startOf('month');  // Get the first day of the month
    const weekOfMonth = Math.floor(firstDayDateLuxon.diff(startOfMonth, 'days').days / 7) + 1;  // Week number within the month
    
    // Create the week string, e.g., "2025-February-Week1"
    const weekString = `${month}-Week${weekOfMonth}`;

    console.log("weekString:", weekString);

    // Fetch commodities with prices set within the week range (weekString)
    const commoditiesWithPrice = await AdminCommodityPriceModel.find({
      week: weekString,  // Find the commodity with price for the exact weekString
    }).distinct('commodity');  // Get distinct commodity IDs with prices for the week range

    console.log("commoditiesWithPrice:", commoditiesWithPrice);

    // Build the query for commodities
    let query = {};
    if (searchValue) {
      query = {
        $or: [
          { name: { $regex: searchValue, $options: "i" } }, // Partial match for 'name'
          { $text: { $search: searchValue } }, // Full-text search
        ],
      };
    }

    // Fetch commodities with pagination and sorting
    const [commodities, totalCommodities] = await Promise.all([
      CommodityModel.find(query).skip(skipPage).limit(limit).sort({ createdAt: -1 }),
      CommodityModel.countDocuments(query),
    ]);

    // Include the 'done' variable and the associated AdminCommodityPrice in the response for each commodity
    const commoditiesWithDoneStatus = await Promise.all(commodities.map(async (commodity) => {
      const commodityObj = commodity.toObject(); // Convert to plain object

      // Check if the commodity exists in commoditiesWithPrice (i.e., if its _id is present)
      const commodityId = commodityObj._id.toString(); // Convert ObjectId to string for comparison
      commodityObj.done = commoditiesWithPrice.some(id => id.toString() === commodityId); // Compare as strings

      // Fetch the AdminCommodityPrice for this commodity within the week range
      const priceData = await AdminCommodityPriceModel.findOne({
        commodity: commodityObj._id,
        week: weekString
      });

      // Include price data (if it exists)
      if (priceData) {
        commodityObj.price = priceData.price;
        commodityObj.updatedBy = priceData.updatedBy;
      }

      return commodityObj;
    }));

    console.log(commoditiesWithDoneStatus);
    responseReturn(res, 200, { totalCommodities, commodities: commoditiesWithDoneStatus });
  } catch (error) {
    console.error(error.message);
    responseReturn(res, 500, { message: "An error occurred while fetching commodities." });
  }
};

 update_commodity = async (req, res) => {
    const { id } = req.params;
    const { name, description, price } = req.body;

    if (!id || !name || !description || !price) {
      return responseReturn(res, 400, { error: "Missing required fields" });
    }

    try {
      const commodity = await commodityModel.findById(id);
      if (!commodity) {
        return responseReturn(res, 404, { error: "Commodity not found" });
      }

      commodity.name = name;
      commodity.description = description;
      commodity.price = price;
      commodity.updatedBy = req.id; // Use req.id from authMiddleware

      await commodity.save();

      return responseReturn(res, 200, {
        message: "Commodity updated successfully",
        commodity,
      });
    } catch (error) {
      console.error("Error updating commodity:", error);
      return responseReturn(res, 500, { error: "Internal server error" });
    }
  };


add_commodity_price = async (req, res) => {
  const { commodityId, price, week } = req.body;
  console.log("ADD")
  console.log(req.body)

  if (!req.id || !req.role || !commodityId || !price || !week || !week.firstDay || !week.lastDay) {
    return responseReturn(res, 400, { error: "Required fields missing" });
  }

  try {
    // Convert firstDay to DateTime
    const firstDayDate = DateTime.fromISO(week.firstDay);

    // Format month (e.g., "2025-February")
    const month = firstDayDate.toFormat('yyyy-MMMM');

    // Calculate the week number in the month (using firstDay)
    const startOfMonth = firstDayDate.startOf('month');  // Get the first day of the month
    const weekOfMonth = Math.floor(firstDayDate.diff(startOfMonth, 'days').days / 7) + 1;  // Week number within the month
    
    // Create the week string, e.g., "2025-February-Week1"
    const weekString = `${month}-Week${weekOfMonth}`;

    // Check if the price for the given week already exists
    const existingPrice = await AdminCommodityPriceModel.findOne({ commodity: commodityId, week: weekString });
    if (existingPrice) {
      return responseReturn(res, 409, { error: "Price for this week already exists" });
    }

    // Create the new commodity price entry
    const newPrice = await AdminCommodityPriceModel.create({
      commodity: commodityId,
      price: parseFloat(price), // Ensure the price is a float
      week: weekString,
      updatedBy: req.id, // Admin ID from authenticated user
    });

    return responseReturn(res, 201, {
      message: "Commodity price added successfully",
      newPrice,
    });
  } catch (error) {
    console.error("Error:", error);
    return responseReturn(res, 500, { error: "Internal server error" });
  }
};



  // Get Commodity Price for a specific week
  get_commodity_price = async (req, res) => {
    const { commodityId, week } = req.query;

    if (!commodityId || !week) {
      return responseReturn(res, 400, { error: "Commodity ID and week are required" });
    }

    try {
      const priceData = await AdminCommodityPriceModel.findOne({ commodity: commodityId, week });
      if (!priceData) {
        return responseReturn(res, 404, { error: "Commodity price not found for this week" });
      }

      return responseReturn(res, 200, {
        message: "Commodity price fetched successfully",
        priceData,
      });
    } catch (error) {
      console.error("Error:", error);
      return responseReturn(res, 500, { error: "Internal server error" });
    }
  };




  // Update Admin Commodity Price
  update_commodity_price = async (req, res) => {
    const { priceId } = req.params;
    const { price, week } = req.body;

    if (!price || !week) {
      return responseReturn(res, 400, { error: "Price and week are required" });
    }

    try {
      const priceData = await AdminCommodityPriceModel.findById(priceId);
      if (!priceData) {
        return responseReturn(res, 404, { error: "Price not found" });
      }

      priceData.price = price;
      priceData.week = week;
      priceData.updatedBy = req.id; // Admin ID from authenticated user

      await priceData.save();

      return responseReturn(res, 200, {
        message: "Commodity price updated successfully",
        priceData,
      });
    } catch (error) {
      console.error("Error:", error);
      return responseReturn(res, 500, { error: "Internal server error" });
    }
  };

  // Delete Admin Commodity Price
  delete_commodity_price = async (req, res) => {
    const { priceId } = req.params;

    if (!priceId) {
      return responseReturn(res, 400, { error: "Price ID must be provided" });
    }

    try {
      const priceData = await AdminCommodityPriceModel.findById(priceId);
      if (!priceData) {
        return responseReturn(res, 404, { error: "Price not found" });
      }

      await AdminCommodityPriceModel.deleteOne({ _id: priceData._id });

      return responseReturn(res, 200, {
        message: "Commodity price deleted successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      return responseReturn(res, 500, { error: "Internal server error" });
    }
  };
  get_commodity_data = async (req, res) => {
    console.log("Fetching data...");
    try {
        const { id } = req.params;
        const { month, year: queryYear, sortBy, sortOrder } = req.query;

        // Use the provided year or default to the current year if not provided
        const currentYear = new Date().getFullYear();
        const year = queryYear || currentYear;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid commodity ID' });
        }

        // Fetch commodity and price data
        const commodity = await CommodityModel.findById(id);
        if (!commodity) {
            return res.status(404).json({ message: 'Commodity not found' });
        }

        // Filter by week value for the specified year or month
        const weekFilter = { week: { $regex: new RegExp(`^${year}`) } };
        if (month) {
            const monthMap = {
                "01": "January", "02": "February", "03": "March", "04": "April",
                "05": "May", "06": "June", "07": "July", "08": "August",
                "09": "September", "10": "October", "11": "November", "12": "December"
            };
            const monthName = monthMap[month];
            weekFilter.week.$regex = new RegExp(`^${year}-${monthName}`);
        }

        // Fetch all price data to determine unique years
        const allPriceData = await AdminCommodityPriceModel.find({ commodity: id });
        
        if (!allPriceData.length) {
            return res.status(404).json({ message: 'No price data found for the commodity' });
        }

        // Extract unique years from all week values
        const uniqueYears = [...new Set(allPriceData.map(item => item.week.split('-')[0]))];

        // Fetch price data based on week filter, sorting, and commodity ID for the specified year
        const priceData = await AdminCommodityPriceModel.find({ commodity: id, ...weekFilter }).sort({
            [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
        });

        if (!priceData.length) {
            return res.status(404).json({ message: 'No price data found for the commodity' });
        }

        // Prepare chart data (for the chart itself)
        const chartData = priceData.map(item => {
            // Extract the week (e.g., "2025-February-Week1")
            const weekInfo = item.week.split('-');  // ["2025", "February", "Week1"]
            const year = weekInfo[0];  // Extract year from "2025"
            const monthName = weekInfo[1];  // Extract month name, e.g., "February"
            const weekNumber = weekInfo[2].slice(4); // Extract "1" from "Week1"
            const formattedWeek = `W${String(weekNumber).padStart(2, '0')}`; // Format "Week1" to "W01"

            // Map month name to month number (January = 01, February = 02, etc.)
            const monthMap = {
                January: '01',
                February: '02',
                March: '03',
                April: '04',
                May: '05',
                June: '06',
                July: '07',
                August: '08',
                September: '09',
                October: '10',
                November: '11',
                December: '12',
            };
            const month = monthMap[monthName] || '01'; // Default to '01' if the month is not found

            // Construct label as YYYY-MM-Wxx (e.g., 2025-02-W01)
            const label = `${year}-${month}-${formattedWeek}`;
            return {
                label, // formatted week label with year and correct month
                value: item.price, // Price value
            };
        });

        // Fetch price data based on week filter, sorting, and commodity ID
        const priceData1 = await AdminCommodityPriceModel.find({ commodity: id, ...weekFilter }).sort({
            [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
        });

        if (!priceData1.length) {
            return res.status(404).json({ message: 'No price data found for the commodity' });
        }

        // Get the last 6 items based on the 'week' value
        const latestPriceData = priceData1
            .sort((a, b) => {
                // Parse week into components: year, month, and week number
                const parseWeek = (week) => {
                    const [year, month, weekNumber] = week.split("-");
                    return {
                        year: parseInt(year), // Convert year to integer
                        month: new Date(`${month} 1, 2000`).getMonth() + 1, // Convert month to integer
                        weekNumber: parseInt(weekNumber.replace('Week', '')), // Remove "Week" and convert to integer
                    };
                };

                const weekA = parseWeek(a.week);
                const weekB = parseWeek(b.week);

                // Sort by year, month, then week number in ascending order
                if (weekA.year !== weekB.year) return weekA.year - weekB.year;
                if (weekA.month !== weekB.month) return weekA.month - weekB.month;
                return weekA.weekNumber - weekB.weekNumber;
            })
            .slice(0, -6); // Take the last 6 items after sorting

        // Calculate fluctuation for all data, not just the last 6
        const fluctuationData = priceData.map((item, index, array) => {
            const previousPrice = index > 0 ? array[index - 1].price : null;
            const fluctuation = previousPrice !== null ? item.price - previousPrice : 0;
            const change = fluctuation > 0 ? `+${fluctuation}` : `${fluctuation}`;

            return {
                commodity: commodity.name, // Name of the commodity
                price: item.price, // Price for the week
                change, // Fluctuation value
                updatedAt: item.week, // Use the week value as the updated time
                unit: commodity.unit, // Unit of the commodity (from the commodity model)
            };
        });

        // Return chart data, fluctuation data, and years
        return res.status(200).json({
            chartData,  // Send chart data for the chart
            fluctuationData, // Send fluctuation data for the table
            years: uniqueYears // Send array of unique years from the week values
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//   get_commodity_data = async (req, res) => {
//     console.log("Fetching data...");
//     try {
//         const { id } = req.params;
//         const { month, year: queryYear, sortBy, sortOrder } = req.query;

//         // Use the provided year or default to the current year if not provided
//         const currentYear = new Date().getFullYear();
//         const year = queryYear || currentYear;

//         // Validate ID
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: 'Invalid commodity ID' });
//         }

//         // Fetch commodity and price data
//         const commodity = await CommodityModel.findById(id);
//         if (!commodity) {
//             return res.status(404).json({ message: 'Commodity not found' });
//         }

//         // Filter by week value instead of createdAt
//         const weekFilter = { week: { $regex: new RegExp(`^${year}`) } };
//         if (month) {
//             const monthMap = {
//                 "01": "January", "02": "February", "03": "March", "04": "April",
//                 "05": "May", "06": "June", "07": "July", "08": "August",
//                 "09": "September", "10": "October", "11": "November", "12": "December"
//             };
//             const monthName = monthMap[month];
//             weekFilter.week.$regex = new RegExp(`^${year}-${monthName}`);
//         }

//         // Fetch price data based on week filter, sorting, and commodity ID
//         const priceData = await AdminCommodityPriceModel.find({ commodity: id, ...weekFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Extract unique years from the week values
//         const uniqueYears = [...new Set(priceData.map(item => item.week.split('-')[0]))];

//         // Prepare chart data (for the chart itself)
//         const chartData = priceData.map(item => {
//             // Extract the week (e.g., "2025-February-Week1")
//             const weekInfo = item.week.split('-');  // ["2025", "February", "Week1"]
//             const year = weekInfo[0];  // Extract year from "2025"
//             const monthName = weekInfo[1];  // Extract month name, e.g., "February"
//             const weekNumber = weekInfo[2].slice(4); // Extract "1" from "Week1"
//             const formattedWeek = `W${String(weekNumber).padStart(2, '0')}`; // Format "Week1" to "W01"

//             // Map month name to month number (January = 01, February = 02, etc.)
//             const monthMap = {
//                 January: '01',
//                 February: '02',
//                 March: '03',
//                 April: '04',
//                 May: '05',
//                 June: '06',
//                 July: '07',
//                 August: '08',
//                 September: '09',
//                 October: '10',
//                 November: '11',
//                 December: '12',
//             };
//             const month = monthMap[monthName] || '01'; // Default to '01' if the month is not found

//             // Construct label as YYYY-MM-Wxx (e.g., 2025-02-W01)
//             const label = `${year}-${month}-${formattedWeek}`;
//             return {
//                 label, // formatted week label with year and correct month
//                 value: item.price, // Price value
//             };
//         });

//         // Fetch price data based on week filter, sorting, and commodity ID
//         const priceData1 = await AdminCommodityPriceModel.find({ commodity: id, ...weekFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData1.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Get the last 6 items based on the 'week' value
//         const latestPriceData = priceData1
//             .sort((a, b) => {
//                 // Parse week into components: year, month, and week number
//                 const parseWeek = (week) => {
//                     const [year, month, weekNumber] = week.split("-");
//                     return {
//                         year: parseInt(year), // Convert year to integer
//                         month: new Date(`${month} 1, 2000`).getMonth() + 1, // Convert month to integer
//                         weekNumber: parseInt(weekNumber.replace('Week', '')), // Remove "Week" and convert to integer
//                     };
//                 };

//                 const weekA = parseWeek(a.week);
//                 const weekB = parseWeek(b.week);

//                 // Sort by year, month, then week number in ascending order
//                 if (weekA.year !== weekB.year) return weekA.year - weekB.year;
//                 if (weekA.month !== weekB.month) return weekA.month - weekB.month;
//                 return weekA.weekNumber - weekB.weekNumber;
//             })
//             .slice(0, -6); // Take the last 6 items after sorting

//         // Calculate fluctuation for all data, not just the last 6
//         const fluctuationData = priceData.map((item, index, array) => {
//             const previousPrice = index > 0 ? array[index - 1].price : null;
//             const fluctuation = previousPrice !== null ? item.price - previousPrice : 0;
//             const change = fluctuation > 0 ? `+${fluctuation}` : `${fluctuation}`;

//             return {
//                 commodity: commodity.name, // Name of the commodity
//                 price: item.price, // Price for the week
//                 change, // Fluctuation value
//                 updatedAt: item.week, // Use the week value as the updated time
//                 unit: commodity.unit, // Unit of the commodity (from the commodity model)
//             };
//         });

//         // Return chart data, fluctuation data, and years
//         return res.status(200).json({
//             chartData,  // Send chart data for the chart
//             fluctuationData, // Send fluctuation data for the table
//             years: uniqueYears // Send array of unique years from the week values
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// };


//   get_commodity_data = async (req, res) => {
//     console.log("Fetching data...");
//     try {
//         const { id } = req.params;
//         const { month, year: queryYear, sortBy, sortOrder } = req.query;

//         // Use the provided year or default to the current year if not provided
//         const currentYear = new Date().getFullYear();
//         const year = queryYear || 2023;

//         // Validate ID
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: 'Invalid commodity ID' });
//         }

//         // Fetch commodity and price data
//         const commodity = await CommodityModel.findById(id);
//         if (!commodity) {
//             return res.status(404).json({ message: 'Commodity not found' });
//         }

//         // Filter by week value instead of createdAt
//         const weekFilter = { week: { $regex: new RegExp(`^${year}`) } };
//         if (month) {
//             const monthMap = {
//                 "01": "January", "02": "February", "03": "March", "04": "April",
//                 "05": "May", "06": "June", "07": "July", "08": "August",
//                 "09": "September", "10": "October", "11": "November", "12": "December"
//             };
//             const monthName = monthMap[month];
//             weekFilter.week.$regex = new RegExp(`^${year}-${monthName}`);
//         }

//         // Fetch price data based on week filter, sorting, and commodity ID
//         const priceData = await AdminCommodityPriceModel.find({ commodity: id, ...weekFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Prepare chart data (for the chart itself)
//         const chartData = priceData.map(item => {
//             // Extract the week (e.g., "2025-February-Week1")
//             const weekInfo = item.week.split('-');  // ["2025", "February", "Week1"]
//             const year = weekInfo[0];  // Extract year from "2025"
//             const monthName = weekInfo[1];  // Extract month name, e.g., "February"
//             const weekNumber = weekInfo[2].slice(4); // Extract "1" from "Week1"
//             const formattedWeek = `W${String(weekNumber).padStart(2, '0')}`; // Format "Week1" to "W01"

//             // Map month name to month number (January = 01, February = 02, etc.)
//             const monthMap = {
//                 January: '01',
//                 February: '02',
//                 March: '03',
//                 April: '04',
//                 May: '05',
//                 June: '06',
//                 July: '07',
//                 August: '08',
//                 September: '09',
//                 October: '10',
//                 November: '11',
//                 December: '12',
//             };
//             const month = monthMap[monthName] || '01'; // Default to '01' if the month is not found

//             // Construct label as YYYY-MM-Wxx (e.g., 2025-02-W01)
//             const label = `${year}-${month}-${formattedWeek}`;
//             return {
//                 label, // formatted week label with year and correct month
//                 value: item.price, // Price value
//             };
//         });

//         // Fetch price data based on week filter, sorting, and commodity ID
//         const priceData1 = await AdminCommodityPriceModel.find({ commodity: id, ...weekFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData1.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Get the last 6 items based on the 'week' value
//         const latestPriceData = priceData1
//             .sort((a, b) => {
//                 // Parse week into components: year, month, and week number
//                 const parseWeek = (week) => {
//                     const [year, month, weekNumber] = week.split("-");
//                     return {
//                         year: parseInt(year), // Convert year to integer
//                         month: new Date(`${month} 1, 2000`).getMonth() + 1, // Convert month to integer
//                         weekNumber: parseInt(weekNumber.replace('Week', '')), // Remove "Week" and convert to integer
//                     };
//                 };

//                 const weekA = parseWeek(a.week);
//                 const weekB = parseWeek(b.week);

//                 // Sort by year, month, then week number in ascending order
//                 if (weekA.year !== weekB.year) return weekA.year - weekB.year;
//                 if (weekA.month !== weekB.month) return weekA.month - weekB.month;
//                 return weekA.weekNumber - weekB.weekNumber;
//             })
//             .slice(0, -6); // Take the last 6 items after sorting

//         // Calculate fluctuation for all data, not just the last 6
//         const fluctuationData = priceData.map((item, index, array) => {
//             const previousPrice = index > 0 ? array[index - 1].price : null;
//             const fluctuation = previousPrice !== null ? item.price - previousPrice : 0;
//             const change = fluctuation > 0 ? `+${fluctuation}` : `${fluctuation}`;

//             return {
//                 commodity: commodity.name, // Name of the commodity
//                 price: item.price, // Price for the week
//                 change, // Fluctuation value
//                 updatedAt: item.week, // Use the week value as the updated time
//                 unit: commodity.unit, // Unit of the commodity (from the commodity model)
//             };
//         });

//         // Return both chart data and fluctuation data
//           return res.status(200).json({
//               chartData,  // Send chart data for the chart
//               fluctuationData,
//               // years // Send fluctuation data for the table
//           });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// };

//    get_commodity_data = async (req, res) => {
//     console.log("Fetching data...");
//     try {
//         const { id } = req.params;
//         const { month, year: queryYear, sortBy, sortOrder } = req.query;

//         // Use the provided year or default to the current year if not provided
//         const currentYear = new Date().getFullYear();
//         const year = queryYear || currentYear;

//         console.log(year)

//         // Validate ID
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: 'Invalid commodity ID' });
//         }

//         // Fetch commodity and price data
//         const commodity = await CommodityModel.findById(id);
//         if (!commodity) {
//             return res.status(404).json({ message: 'Commodity not found' });
//         }

//         // Build the filter object for year and month if they are provided
//         const dateFilter = {};
//         if (year) {
//             dateFilter.createdAt = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) };
//         }
//         if (month) {
//             const monthStart = new Date(`${year}-${month}-01`);
//             const monthEnd = new Date(`${year}-${parseInt(month) + 1}-01`);
//             dateFilter.createdAt = { $gte: monthStart, $lt: monthEnd };
//         }

//         // Fetch price data based on date filter, sorting, and commodity ID
//         const priceData = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Prepare chart data (for the chart itself)
//         const chartData = priceData
//             .filter(item => item.week.startsWith(year)) // Filter data to include only weeks in the specified year
//             .map(item => {
//                 // Extract the week (e.g., "2025-February-Week1")
//                 const weekInfo = item.week.split('-');  // ["2025", "February", "Week1"]
//                 const year = weekInfo[0];  // Extract year from "2025"
//                 const monthName = weekInfo[1];  // Extract month name, e.g., "February"
//                 const weekNumber = weekInfo[2].slice(4); // Extract "1" from "Week1"
//                 const formattedWeek = `W${String(weekNumber).padStart(2, '0')}`; // Format "Week1" to "W01"

//                 // Map month name to month number (January = 01, February = 02, etc.)
//                 const monthMap = {
//                     January: '01',
//                     February: '02',
//                     March: '03',
//                     April: '04',
//                     May: '05',
//                     June: '06',
//                     July: '07',
//                     August: '08',
//                     September: '09',
//                     October: '10',
//                     November: '11',
//                     December: '12',
//                 };
//                 const month = monthMap[monthName] || '01'; // Default to '01' if the month is not found

//                 // Construct label as YYYY-MM-Wxx (e.g., 2025-02-W01)
//                 const label = `${year}-${month}-${formattedWeek}`;
//                 return {
//                     label, // formatted week label with year and correct month
//                     value: item.price, // Price value
//                 };
//             });

//         // Fetch price data based on date filter, sorting, and commodity ID
//         const priceData1 = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData1.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Get the last 6 items based on the 'week' value
//         const latestPriceData = priceData1
//             .sort((a, b) => {
//                 // Parse week into components: year, month, and week number
//                 const parseWeek = (week) => {
//                     const [year, month, weekNumber] = week.split("-");
//                     return {
//                         year: parseInt(year), // Convert year to integer
//                         month: new Date(`${month} 1, 2000`).getMonth() + 1, // Convert month to integer
//                         weekNumber: parseInt(weekNumber.replace('Week', '')), // Remove "Week" and convert to integer
//                     };
//                 };

//                 const weekA = parseWeek(a.week);
//                 const weekB = parseWeek(b.week);

//                 // Sort by year, month, then week number in ascending order
//                 if (weekA.year !== weekB.year) return weekA.year - weekB.year;
//                 if (weekA.month !== weekB.month) return weekA.month - weekB.month;
//                 return weekA.weekNumber - weekB.weekNumber;
//             })
//             .slice(0, -6); // Take the last 6 items after sorting

//         // Calculate fluctuation for all data, not just the last 6
//         const fluctuationData = priceData.map((item, index, array) => {
//             const previousPrice = index > 0 ? array[index - 1].price : null;
//             const fluctuation = previousPrice !== null ? item.price - previousPrice : 0;
//             const change = fluctuation > 0 ? `+${fluctuation}` : `${fluctuation}`;

//             return {
//                 commodity: commodity.name, // Name of the commodity
//                 price: item.price, // Price for the week
//                 change, // Fluctuation value
//                 updatedAt: item.week, // Use the week value as the updated time
//                 unit: commodity.unit, // Unit of the commodity (from the commodity model)
//             };
//         });

//         // Return both chart data and fluctuation data
//         return res.status(200).json({
//             chartData,  // Send chart data for the chart
//             fluctuationData, // Send fluctuation data for the table
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// };

//   get_commodity_data = async (req, res) => {
//     console.log("Fetching data...");
//     try {
//         const { id } = req.params;
//         const { month, sortBy, sortOrder } = req.query;

//         // Set the year to 2025
//         const year = "2024";

//         // Validate ID
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: 'Invalid commodity ID' });
//         }

//         // Fetch commodity and price data
//         const commodity = await CommodityModel.findById(id);
//         if (!commodity) {
//             return res.status(404).json({ message: 'Commodity not found' });
//         }

//         // Build the filter object for year and month if they are provided
//         const dateFilter = {};
//         if (year) {
//             dateFilter.createdAt = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) };
//         }
//         if (month) {
//             const monthStart = new Date(`${year}-${month}-01`);
//             const monthEnd = new Date(`${year}-${parseInt(month) + 1}-01`);
//             dateFilter.createdAt = { $gte: monthStart, $lt: monthEnd };
//         }

//         // Fetch price data based on date filter, sorting, and commodity ID
//         const priceData = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Prepare chart data (for the chart itself)
//         const chartData = priceData
//             .filter(item => item.week.startsWith(year)) // Filter data to include only weeks in 2025
//             .map(item => {
//                 // Extract the week (e.g., "2025-February-Week1")
//                 const weekInfo = item.week.split('-');  // ["2025", "February", "Week1"]
//                 const year = weekInfo[0];  // Extract year from "2025"
//                 const monthName = weekInfo[1];  // Extract month name, e.g., "February"
//                 const weekNumber = weekInfo[2].slice(4); // Extract "1" from "Week1"
//                 const formattedWeek = `W${String(weekNumber).padStart(2, '0')}`; // Format "Week1" to "W01"

//                 // Map month name to month number (January = 01, February = 02, etc.)
//                 const monthMap = {
//                     January: '01',
//                     February: '02',
//                     March: '03',
//                     April: '04',
//                     May: '05',
//                     June: '06',
//                     July: '07',
//                     August: '08',
//                     September: '09',
//                     October: '10',
//                     November: '11',
//                     December: '12',
//                 };
//                 const month = monthMap[monthName] || '01'; // Default to '01' if the month is not found

//                 // Construct label as YYYY-MM-Wxx (e.g., 2025-02-W01)
//                 const label = `${year}-${month}-${formattedWeek}`;
//                 return {
//                     label, // formatted week label with year and correct month
//                     value: item.price, // Price value
//                 };
//             });

//         // Fetch price data based on date filter, sorting, and commodity ID
//         const priceData1 = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData1.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Get the last 6 items based on the 'week' value
//         const latestPriceData = priceData1
//             .sort((a, b) => {
//                 // Parse week into components: year, month, and week number
//                 const parseWeek = (week) => {
//                     const [year, month, weekNumber] = week.split("-");
//                     return {
//                         year: parseInt(year), // Convert year to integer
//                         month: new Date(`${month} 1, 2000`).getMonth() + 1, // Convert month to integer
//                         weekNumber: parseInt(weekNumber.replace('Week', '')), // Remove "Week" and convert to integer
//                     };
//                 };

//                 const weekA = parseWeek(a.week);
//                 const weekB = parseWeek(b.week);

//                 // Sort by year, month, then week number in ascending order
//                 if (weekA.year !== weekB.year) return weekA.year - weekB.year;
//                 if (weekA.month !== weekB.month) return weekA.month - weekB.month;
//                 return weekA.weekNumber - weekB.weekNumber;
//             })
//             .slice(0, -6); // Take the last 6 items after sorting

//         // Calculate fluctuation for all data, not just the last 6
//         const fluctuationData = priceData.map((item, index, array) => {
//             const previousPrice = index > 0 ? array[index - 1].price : null;
//             const fluctuation = previousPrice !== null ? item.price - previousPrice : 0;
//             const change = fluctuation > 0 ? `+${fluctuation}` : `${fluctuation}`;

//             return {
//                 commodity: commodity.name, // Name of the commodity
//                 price: item.price, // Price for the week
//                 change, // Fluctuation value
//                 updatedAt: item.week, // Use the week value as the updated time
//                 unit: commodity.unit, // Unit of the commodity (from the commodity model)
//             };
//         });

//         // Return both chart data and fluctuation data
//         return res.status(200).json({
//             chartData,  // Send chart data for the chart
//             fluctuationData, // Send fluctuation data for the table
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// };

//   get_commodity_data = async (req, res) => {
//     console.log("Fetching data...");
//     try {
//         const { id } = req.params;
//         const { month, sortBy, sortOrder } = req.query;

//         // Use current year if not provided in query
//         const currentYear = new Date().getFullYear();
//         const year = req.query.year || currentYear;

//         console.log(year)
//         // Validate ID
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: 'Invalid commodity ID' });
//         }

//         // Fetch commodity and price data
//         const commodity = await CommodityModel.findById(id);
//         if (!commodity) {
//             return res.status(404).json({ message: 'Commodity not found' });
//         }

//         // Build the filter object for year and month if they are provided
//         const dateFilter = {};
//         if (year) {
//             dateFilter.createdAt = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) };
//         }
//         if (month) {
//             const monthStart = new Date(`${year}-${month}-01`);
//             const monthEnd = new Date(`${year}-${parseInt(month) + 1}-01`);
//             dateFilter.createdAt = { $gte: monthStart, $lt: monthEnd };
//         }

//         // Fetch price data based on date filter, sorting, and commodity ID
//         const priceData = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Prepare chart data (for the chart itself)
//         const chartData = priceData.map(item => {
//             // Extract the week (e.g., "2025-February-Week1")
//             const weekInfo = item.week.split('-');  // ["2025", "February", "Week1"]
//             const year = weekInfo[0];  // Extract year from "2025"
//             const monthName = weekInfo[1];  // Extract month name, e.g., "February"
//             const weekNumber = weekInfo[2].slice(4); // Extract "1" from "Week1"
//             const formattedWeek = `W${String(weekNumber).padStart(2, '0')}`; // Format "Week1" to "W01"

//             // Map month name to month number (January = 01, February = 02, etc.)
//             const monthMap = {
//                 January: '01',
//                 February: '02',
//                 March: '03',
//                 April: '04',
//                 May: '05',
//                 June: '06',
//                 July: '07',
//                 August: '08',
//                 September: '09',
//                 October: '10',
//                 November: '11',
//                 December: '12',
//             };
//             const month = monthMap[monthName] || '01'; // Default to '01' if the month is not found

//             // Construct label as YYYY-MM-Wxx (e.g., 2025-02-W01)
//             const label = `${year}-${month}-${formattedWeek}`;
//             return {
//                 label, // formatted week label with year and correct month
//                 value: item.price, // Price value
//             };
//         });

//         // Fetch price data based on date filter, sorting, and commodity ID
//         const priceData1 = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
//             [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
//         });

//         if (!priceData1.length) {
//             return res.status(404).json({ message: 'No price data found for the commodity' });
//         }

//         // Get the last 6 items based on the 'week' value
//         const latestPriceData = priceData1
//             .sort((a, b) => {
//                 // Parse week into components: year, month, and week number
//                 const parseWeek = (week) => {
//                     const [year, month, weekNumber] = week.split("-");
//                     return {
//                         year: parseInt(year), // Convert year to integer
//                         month: new Date(`${month} 1, 2000`).getMonth() + 1, // Convert month to integer
//                         weekNumber: parseInt(weekNumber.replace('Week', '')), // Remove "Week" and convert to integer
//                     };
//                 };

//                 const weekA = parseWeek(a.week);
//                 const weekB = parseWeek(b.week);

//                 // Sort by year, month, then week number in ascending order
//                 if (weekA.year !== weekB.year) return weekA.year - weekB.year;
//                 if (weekA.month !== weekB.month) return weekA.month - weekB.month;
//                 return weekA.weekNumber - weekB.weekNumber;
//             })
//             .slice(0, -6); // Take the last 6 items after sorting

//         // Calculate fluctuation for all data, not just the last 6
//         const fluctuationData = priceData.map((item, index, array) => {
//             const previousPrice = index > 0 ? array[index - 1].price : null;
//             const fluctuation = previousPrice !== null ? item.price - previousPrice : 0;
//             const change = fluctuation > 0 ? `+${fluctuation}` : `${fluctuation}`;

//             return {
//                 commodity: commodity.name, // Name of the commodity
//                 price: item.price, // Price for the week
//                 change, // Fluctuation value
//                 updatedAt: item.week, // Use the week value as the updated time
//                 unit: commodity.unit, // Unit of the commodity (from the commodity model)
//             };
//         });

//         // Return both chart data and fluctuation data
//         return res.status(200).json({
//             chartData,  // Send chart data for the chart
//             fluctuationData, // Send fluctuation data for the table
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// };

  


  // get_commodity_data = async (req, res) => {
  //   console.log("Fetching data...");
  //   try {
  //     const { id } = req.params;
  //     const { month, sortBy, sortOrder } = req.query; // Retrieve the query parameters
  //     const year = "2024"
  //     // Validate ID
  //     if (!mongoose.Types.ObjectId.isValid(id)) {
  //       return res.status(400).json({ message: 'Invalid commodity ID' });
  //     }
  
  //     // Fetch commodity and price data
  //     const commodity = await CommodityModel.findById(id);
  //     if (!commodity) {
  //       return res.status(404).json({ message: 'Commodity not found' });
  //     }
  
  //     // Build the filter object for year and month if they are provided
  //     const dateFilter = {};
  //     if (year) {
  //       dateFilter.createdAt = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) };
  //     }
  //     if (month) {
  //       const monthStart = new Date(`${year}-${month}-01`);
  //       const monthEnd = new Date(`${year}-${parseInt(month) + 1}-01`);
  //       dateFilter.createdAt = { $gte: monthStart, $lt: monthEnd };
  //     }
  
  //     // Fetch price data based on date filter, sorting, and commodity ID
  //     const priceData = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
  //       [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
  //     });
  
  //     if (!priceData.length) {
  //       return res.status(404).json({ message: 'No price data found for the commodity' });
  //     }
  
  //     // Prepare chart data (for the chart itself)
  //     const chartData = priceData.map(item => {
  //       // Extract the week (e.g., "2025-February-Week1")
  //       const weekInfo = item.week.split('-');  // ["2025", "February", "Week1"]
  //       const year = weekInfo[0];  // Extract year from "2025"
  //       const monthName = weekInfo[1];  // Extract month name, e.g., "February"
  //       const weekNumber = weekInfo[2].slice(4); // Extract "1" from "Week1"
  //       const formattedWeek = `W${String(weekNumber).padStart(2, '0')}`; // Format "Week1" to "W01"
  
  //       // Map month name to month number (January = 01, February = 02, etc.)
  //       const monthMap = {
  //         January: '01',
  //         February: '02',
  //         March: '03',
  //         April: '04',
  //         May: '05',
  //         June: '06',
  //         July: '07',
  //         August: '08',
  //         September: '09',
  //         October: '10',
  //         November: '11',
  //         December: '12',
  //       };
  //       const month = monthMap[monthName] || '01'; // Default to '01' if the month is not found
  
  //       // Construct label as YYYY-MM-Wxx (e.g., 2025-02-W01)
  //       const label = `${year}-${month}-${formattedWeek}`;
  //       return {
  //         label, // formatted week label with year and correct month
  //         value: item.price, // Price value
  //       };
  //     });
  //   // Fetch price data based on date filter, sorting, and commodity ID
  //   const priceData1 = await AdminCommodityPriceModel.find({ commodity: id, ...dateFilter }).sort({
  //     [sortBy || 'week']: sortOrder === 'desc' ? -1 : 1, // Default sort by week, ascending
  //   });

  //   if (!priceData1.length) {
  //     return res.status(404).json({ message: 'No price data found for the commodity' });
  //   }

  //   // Get the last 6 items based on the 'week' value
  //   const latestPriceData = priceData1
  //     .sort((a, b) => {
  //       // Parse week into components: year, month, and week number
  //       const parseWeek = (week) => {
  //         const [year, month, weekNumber] = week.split("-");
  //         return {
  //           year: parseInt(year), // Convert year to integer
  //           month: new Date(`${month} 1, 2000`).getMonth() + 1, // Convert month to integer
  //           weekNumber: parseInt(weekNumber.replace('Week', '')), // Remove "Week" and convert to integer
  //         };
  //       };

  //       const weekA = parseWeek(a.week);
  //       const weekB = parseWeek(b.week);

  //       // Sort by year, month, then week number in ascending order
  //       if (weekA.year !== weekB.year) return weekA.year - weekB.year;
  //       if (weekA.month !== weekB.month) return weekA.month - weekB.month;
  //       return weekA.weekNumber - weekB.weekNumber;
  //     })
  //     .slice(0,-6); // Take the last 6 items after sorting

  //   // Calculate fluctuation for all data, not just the last 6
  //   const fluctuationData = priceData.map((item, index, array) => {
  //     const previousPrice = index > 0 ? array[index - 1].price : null;
  //     const fluctuation = previousPrice !== null ? item.price - previousPrice : 0;
  //     const change = fluctuation > 0 ? `+${fluctuation}` : `${fluctuation}`;

  //     return {
  //       commodity: commodity.name, // Name of the commodity
  //       price: item.price, // Price for the week
  //       change, // Fluctuation value
  //       updatedAt: item.week, // Use the week value as the updated time
  //       unit: commodity.unit, // Unit of the commodity (from the commodity model)
  //     };
  //   });


  
  //     // Return both chart data and fluctuation data
  //     return res.status(200).json({
  //       chartData,  // Send chart data for the chart
  //       fluctuationData, // Send fluctuation data for the table
  //     });
  //   } catch (err) {
  //     console.error(err);
  //     res.status(500).json({ message: 'Server error' });
  //   }
  // };
  
  
}

module.exports = new commodityController();
