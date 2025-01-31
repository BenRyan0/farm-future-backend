const mongoose = require('mongoose');

const commoditySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    auditLogs: [{
        action: {
            type: String,
            enum: ['created', 'updated'],
            required: true
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'role',
            required: true
        },
        role: {
            type: String,
            enum: ['Admin', 'Seller'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        changes: {
            type: Map,
            of: String
        }
    }]
});

// Create and export the model
module.exports = mongoose.model('Commodity', commoditySchema);
