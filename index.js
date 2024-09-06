const express=require("express");
const Restaurant=require("./models/restaurant");
const app=express();
const Food=require("./models/food")
const User=require("./models/user");
const Order=require("./models/order")
const Cart = require('./models/Cart');
const Notification=require("./models/Notifications")
const bcrypt = require('bcrypt');
const session = require('express-session');
const path=require("path")
const jwt = require('jsonwebtoken');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const port=8000;
const saltRounds = 10; 
const cookieParser = require('cookie-parser');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key', // Replace with your own secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Use `secure: true` in production with HTTPS
}));

app.get('/', (req, res) => {
    res.redirect('/food-home'); // Redirect to a valid route
});


const authenticateToken = (req, res, next) => {
    const token = req.cookies.token; // Get token from cookies

    if (!token) return res.redirect('/login'); // Redirect if no token

    jwt.verify(token, 'secret', (err, user) => {
        if (err) {
            console.error('Token verification error:', err);
            return res.redirect('/login');
        }
        console.log('Token verified, user:', user);
        req.user = user;
        next();
    });
};

app.get('/food-home', authenticateToken, async (req, res) => {
    try {
        const { availability, category } = req.query;
        const userRole = req.user.category; // Get user role from request (user/admin)
        const userId = req.user.userid;

        // Fetch user data (from either User or Restaurant schema)
        let user = await User.findById(userId);
        if (!user) {
            user = await Restaurant.findById(userId);
        }

        let username = 'Guest'; // Default username if not found

        if (user) {
            username = user.email || user.name; // Handle both User and Restaurant schemas
        }

        // Fetch unread notifications count
        const unreadNotificationsCount = await Notification.countDocuments({
            user: userId,
            isRead: false
        });

        // Build the query based on filters (availability and category)
        let query = {};
        if (availability && availability !== 'all') {
            query.availability = availability;
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        // Fetch the filtered food items
        const foods = await Food.find(query);

        // Render the template with all necessary data
        res.render('foods', {
            foods,
            userRole,
            username,
            filter: req.query,
            unreadNotificationsCount // Pass the unread notifications count
        });

    } catch (error) {
        console.error('Error fetching foods:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get("/test", async (req, res) => {
    try {
        let { filter } = req.query;
        // If no filter is provided, default to an empty string to find all items
        
        const foods = await Food.find({ availability: filter });
        console.log(foods);
        res.json(foods); // Send the results as JSON for testing
    } catch (error) {
        console.error('Error fetching foods:', error);
        res.status(500).send('Internal Server Error');
    }
});




app.get("/signup",(req,res)=>{
    res.render("signup")
})

app.post("/signup", async (req, res) => {
    try {
        let { username, email, password, category } = req.body;

        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password, salt);

        let user = await User.create({
            username: username,
            email: email,
            password: hash,
            category: category || "user", // Default to "user" if no category is provided
            orders: [] // Initialize with an empty array for orders
        });

        let token = jwt.sign({ email: user.email, userid: user._id, category: user.category }, "secret", { expiresIn: '1h' });

        res.cookie("token", token)

        res.status(200).json({ message: "User registered successfully" });

    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


app.get("/login",(req,res)=>{
    res.render("login");
})



app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the user by email in the User schema
        let user = await User.findOne({ email: email });

        if (!user) {
            // If not found in User schema, check the Restaurant schema
            user = await Restaurant.findOne({ email: email });
            
            if (!user) {
                // If the user is not found in either schema
                return res.status(404).json({ message: "User not found" });
            }
        }

        // Compare the provided password with the stored hashed password
        bcrypt.compare(password, user.password, function(err, result) {
            if (err) {
                // Handle error during password comparison
                console.error("Error comparing passwords:", err);
                return res.status(500).json({ message: "Internal server error" });
            }

            // If the password matches
            if (result) {
                // Create a JWT token with the category included
                let token = jwt.sign({ email: user.email, userid: user._id, category: user.category }, "secret", { expiresIn: '1h' });

                // Set the token in a cookie
                res.cookie("token", token, {
                    httpOnly: true,
                    secure: false, // Set to true if using HTTPS
                    sameSite: 'lax',
                    maxAge: 3600000 // Cookie expiration time in milliseconds (1 hour)
                });

                // Redirect to the homepage after successful login
                return res.redirect("/food-home")
                
            } else {
                // Password does not match
                return res.status(401).json({ message: "Invalid credentials" });
            }
        });
    } catch (error) {
        // Handle unexpected errors
        console.error("Error during login:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});



app.get("/logout",(req,res)=>{
    res.cookie("token","");
    res.send("logout")
})





app.get("/addRestro",(req,res)=>{
    res.render("new.ejs")
})
app.post('/addRestro', async (req, res) => {
    try {
        const { name, location, contactNumber, email, password, category } = req.body;

        // Hash the password
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new CanteenProvider document with hashed password
        const newProvider = new Restaurant({
            name:name,
            location:location,
            contactNumber:contactNumber,
            email:email,
            password: hashedPassword,
        });

        // Save the document to the database
        await newProvider.save();

        res.status(201).json({ message: "Canteen provider added successfully", data: newProvider });
    } catch (error) {
        console.error("Error adding canteen provider:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


app.get("/addfood",(req,res)=>{
    res.render("newfood.ejs")
})



app.post('/addfood', async (req, res) => {
    try {
        // Extract the JWT token from the cookie
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        // Decode the JWT to extract the user data (including category)
        let decoded;
        try {
            decoded = jwt.verify(token, "secret"); // Replace "secret" with your actual secret key
        } catch (err) {
            return res.status(401).json({ message: "Unauthorized: Invalid token" });
        }

        // Check if the user's category is admin
        if (decoded.category !== "admin") {
            return res.status(403).json({ message: "Forbidden: Only admins can add food items" });
        }

        // Find the restaurant by email (assuming the user is logged in as a restaurant admin)
        let user = await Restaurant.findOne({ email: decoded.email });

        if (!user) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        // Extract food details from the request body
        let { foodname, image, price, description, category } = req.body;

        // Create a new food item
        let food = await Food.create({
            foodname: foodname,  // Assuming 'foodname' is the field in the Food schema for the food's name
            image: image,
            price: price,
            description: description,
            category: category,
            canteenProvider: user._id
        });

        // Add the food item's ID to the restaurant's food list and save
        user.foods.push(food._id);
        await user.save();

        res.redirect('/food-home');
    } catch (error) {
        console.error("Error adding food item:", error);
        res.status(500).send("Internal server error");
    }
});


app.post('/place-order', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userid;
        const { foodId, qty } = req.body; // Extract quantity

        console.log(`User ID: ${userId}`);
        console.log(`Food ID: ${foodId}`);
        console.log(`Quantity: ${qty}`);

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const food = await Food.findById(foodId);
        if (!food) {
            return res.status(404).json({ message: "Food item not found" });
        }

        const quantity = parseInt(qty, 10);
        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ message: "Invalid quantity" });
        }

        const totalPrice = food.price * quantity;

        const newOrder = new Order({
            user: userId,
            food: {
                foodname: food.foodname,
                image: food.image,
                price: food.price,
                description: food.description,
                category: food.category
            },
            qty: quantity, // Save quantity
            totalPrice: totalPrice, // Save total price
            status: 'Pending'
        });

        const savedOrder = await newOrder.save();
        await User.findByIdAndUpdate(userId, {
            $push: { orders: savedOrder._id }
        });

        console.log(`Order placed successfully: ${savedOrder._id}`);
        res.redirect('/orderstatus');

    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


app.get('/orders', authenticateToken, async (req, res) => {
    try {
        // Fetch orders and populate both user and food details
        const orders = await Order.find({}).populate('user').populate('food');

        res.render('orders', { orders });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



app.post('/update-order/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        // Validate the new status
        if (!['Pending', 'Completed'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        // Find the order and update the status
        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true }).populate('user');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Create a notification for the user whose order status was updated
        await Notification.create({
            message: `Your order status has been updated to ${status}`,
            user: order.user._id // Assuming 'user' field refers to the User schema
        });

        // Redirect back to the orders page after the update
        res.redirect('/orders');
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


app.get('/orderstatus', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userid; // Get the user ID from the JWT token

        // Find orders for the logged-in user
        const orders = await Order.find({ user: userId }).populate('food');

        // Render the order status page with the user's orders
        res.render('orderstatus', { orders });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

const ensureAdmin = async (req, res, next) => {
    
        // Get token from cookies
        const token = req.cookies.token; // Make sure 'token' matches the name of your cookie
        
        if (!token){ return res.status(401).send('Not authorized')
        }

    else{
      
        const decoded = jwt.verify(token, 'secret'); 
       // console.log({token,decoded})// Replace 'your_jwt_secret' with your actual secret
        const user = await Restaurant.findById(decoded.userid);
        

        if (!user ) {
            return res.status(403).send('Not authorized');
        }

        req.user = user; // Attach user to request object
        next();
        
    }


    //     // Verify token
       
    // } catch (error) {
    //     console.error('Authentication error:', error);
    //     res.status(401).send('Not authorized');
    // }
};


app.get('/menu', ensureAdmin, async (req, res) => {
    try {
        // Fetch all available foods
        const foods = await Food.find({ });
        
        // Render a page (assuming you have a view engine like EJS, Pug, etc.)
        res.render('menu', { foods }); // Pass the foods to your view
    } catch (error) {
        console.error('Error fetching foods:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/update-availability', async (req, res) => {
    try {
        const { foodId, availability } = req.body; // Get foodId and new availability from the request

        // Validate availability
        if (!['Available', 'Not Available'].includes(availability)) {
            return res.status(400).send('Invalid availability status');
        }

        // Update food availability
        await Food.findByIdAndUpdate(foodId, { availability });

        // Redirect back to menu page
        res.redirect('/menu');
    } catch (error) {
        console.error('Error updating food availability:', error);
        res.status(500).send('Server Error');
    }
});

app.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userid;

        // Fetch notifications for the logged-in user
        const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });

        // Mark notifications as read
        await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });

        res.render('notifications', {
            notifications,  // Pass notifications to the template
            username: req.user.username  // Pass the username if needed
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/cart', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userid;
        const userRole = req.user.category;
        const cart = await Cart.findOne({ user: userId }).populate('items.food');
        const unreadNotificationsCount = await Notification.countDocuments({
            user: userId,
            isRead: false
        });
        

        // Fetch user data (from either User or Restaurant schema)
        let user = await User.findById(userId);

        
        let username = 'Guest'; // Default username if not found

        if (user) {
            username = user.email || user.name; // Handle both User and Restaurant schemas
        }

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Pass the cart object to the template
        res.render('cart', { cart,userRole,unreadNotificationsCount,username });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.post('/cart/add', authenticateToken, async (req, res) => {
    try {
        const { foodId, quantity } = req.body;
        const userId = req.user.userid;

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({ user: userId });
        }

        const itemIndex = cart.items.findIndex(item => item.food.equals(foodId));

        if (itemIndex > -1) {
            // Update existing item
            cart.items[itemIndex].quantity += quantity;
        } else {
            // Add new item
            cart.items.push({ food: foodId, quantity });
        }

        await cart.save();
        res.redirect("/food-home");
    } catch (error) {
        console.error('Error adding item to cart:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/checkout', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userid;
        const { address } = req.body; // Assuming address is provided during checkout

        // Find the cart for the user
        const cart = await Cart.findOne({ user: userId }).populate('items.food');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        // Create orders for each item in the cart
        const orders = cart.items.map(item => ({
            user: userId,
            food: {
                foodname: item.food.foodname,
                image: item.food.image,
                price: item.food.price,
                description: item.food.description,
                category: item.food.category
            },
            qty: item.quantity, // Assuming `quantity` is stored in `cart.items`
            status: 'Pending'
        }));

        // Save all orders
        await Order.insertMany(orders);

        // Clear the cart
        cart.items = [];
        await cart.save();

        res.status(200);
        res.redirect("/orderstatus")
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Update quantity of an item in the cart
app.post('/cart/update', authenticateToken, async (req, res) => {
    try {
        const { itemId, quantity } = req.body;

        // Validate quantity
        if (quantity <= 0) {
            return res.status(400).json({ message: 'Quantity must be at least 1' });
        }

        // Find the cart
        const userId = req.user.userid;
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Find the item in the cart and update quantity
        const item = cart.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        item.quantity = quantity;

        await cart.save();

        res.redirect('/cart'); // Redirect back to the cart page
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Remove an item from the cart
app.post('/cart/remove', authenticateToken, async (req, res) => {
    try {
        const { itemId } = req.body;

        // Find the cart
        const userId = req.user.userid;
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        // Use pull to remove the item from the cart
        const item = cart.items.id(itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        cart.items.pull(itemId); // Remove the item

        await cart.save(); // Save the cart after modification

        res.redirect('/cart'); // Redirect back to the cart page
    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).send('Internal Server Error');
    }
});




app.listen(port,()=>{
    console.log(`listening at port ${port}`);
})