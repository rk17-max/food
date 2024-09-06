const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema({
    foodname: { type: String, required: true },
    image: { type: String },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String, required: true }, // E.g., "Beverages", "Snacks", etc.
    canteenProvider: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenProvider' },
    availability: {
        type: String,
        enum: ['Available', 'Not Available'], // Possible values for availability
        default: 'Available' // Default value
    }
});

const Food = mongoose.model('Food', FoodSchema);
module.exports = Food;
