const commodityModel = require("../../models/Commodity/commodityModel");
const { responseReturn } = require("../../utils/response");
const cloudinary = require("cloudinary").v2;
const formidable = require("formidable");
const sharp = require("sharp");
const fs = require("fs");
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
    // Ensure the user is authenticated
    if (!req.id) {
      return responseReturn(res, 401, { error: "User not authenticated" });
    }

    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return responseReturn(res, 400, { error: "Form parsing error" });
      }

      let { name, description, price } = fields;
      let { image } = files;

      if (!name || !image || !price) {
        return responseReturn(res, 400, { error: "Name, price, or image not provided" });
      }

      name = name.trim();
      const slug = name.split(" ").join("-");

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
        const resizedImagePath = await this.resizeImage(image.filepath || image.path);
        const result = await cloudinary.uploader.upload(resizedImagePath, {
          folder: "commodities",
          timeout: 60000,
        });

        fs.unlinkSync(resizedImagePath); // Delete temp resized image

        if (result) {
          const commodity = await commodityModel.create({
            name,
            slug,
            description,
            price,
            image: result.url,
            createdBy: req.id, // Use req.id from the authMiddleware
          });

          return responseReturn(res, 201, {
            commodity,
            message: "Commodity added successfully",
          });
        } else {
          return responseReturn(res, 500, { error: "Image upload failed" });
        }
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

  get_commodities = async (req, res) => {
    const { page, searchValue, parPage } = req.query;

    try {
      let skipPage = "";
      if (parPage && page) {
        skipPage = parseInt(parPage) * (parseInt(page) - 1);
      }
      const query = searchValue ? { $text: { $search: searchValue } } : {};

      const commodities = await commodityModel
        .find(query)
        .skip(skipPage)
        .limit(parPage)
        .sort({ createdAt: -1 });

      const totalCommodities = await commodityModel.find(query).countDocuments();
      responseReturn(res, 200, { totalCommodities, commodities });
    } catch (error) {
      console.log(error.message);
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
}

module.exports = new commodityController();
