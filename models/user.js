const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// User Schema
const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    orders: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    dateJoined: {
        type: Date,
        default: Date.now
    },
    category:{
        type:String,
        default:"user"
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
