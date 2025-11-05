// Get the packages we need
var express   = require('express');
var router    = express.Router();
var mongoose  = require('mongoose');
var bodyParser= require('body-parser');

// Read .env file
require('dotenv').config();

// Create our Express application
var app  = express();

// Use environment defined port or 3000
var port = process.env.PORT || 3000;

// Allow CORS so that backend and frontend could be put on different servers
var allowCrossDomain = function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
  next();
};
app.use(allowCrossDomain);

// Use the body-parser package in our application
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// (可选) 简单健康检查，便于自测
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'OK', data: { uptime: process.uptime() } });
});

// Use routes as a module (see routes/index.js)
require('./routes')(app, router);

// ---- IMPORTANT: connect to MongoDB BEFORE listening ----
(async () => {
  try {
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set!');
      console.error('Please set MONGODB_URI in Render Environment Variables');
      process.exit(1);
    }

    // 使用环境变量中的连接串
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas');

    app.listen(port, () => {
      console.log('Server running on port ' + port);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('Error details:', err);
    process.exit(1); // 连接失败就退出，避免误以为服务正常
  }
})();
