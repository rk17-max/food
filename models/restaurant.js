const mongoose = require('mongoose');

mongoose.connect("mongodb+srv://backend:9873754056@cluster0.sbrgl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(function() {
    console.log("Connected to MongoDB");
  })
  .catch(function(error) {
    console.error("Failed to connect to MongoDB", error);
  });

const CanteenProviderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: {
        type: String,
        required: true
    },

    foods: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Food' }],
    category:{
        type:String,
        default:"admin"
    }
    // Additional fields like opening hours, ratings, etc., can be added here
});

const CanteenProvider = mongoose.model('CanteenProvider', CanteenProviderSchema);
module.exports=CanteenProvider;