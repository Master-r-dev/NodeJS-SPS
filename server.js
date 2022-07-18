const path = require('path')
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const methodOverride = require('method-override')
const passport = require('passport');
const flash = require('connect-flash');
const session = require('express-session');
const app = express();
const bodyParser=require('body-parser');
// Passport Config
require('./config/passport')(passport);

// DB Config
const db = require('./config/keys').mongoURI;

// Connect to MongoDB
mongoose
  .connect(
    db,
    { useNewUrlParser: true ,useUnifiedTopology: true}
  )
  .then(() => console.log('MongoDB подключен'))
  .catch(err => console.log(err));

// EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');


//Setting static folder
app.use(express.static(path.join(__dirname, 'public')))

// body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Method override
app.use(
  methodOverride(function (req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      // look in urlencoded POST bodies and delete it
      let method = req.body._method
      delete req.body._method
      return method
    }
  })
)

// Express session
app.use(
  session({
    secret: require('./config/keys').secret,
    resave: true,
    saveUninitialized: true
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect flash
app.use(flash());

// Global variables
app.use(function(req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
}); 

// Routes
app.use('/', require('./routes/index.js'));
app.use('/ocs', require('./routes/ocs.js'));
app.use('/ocs/project', require('./routes/project.js'));



const PORT = process.env.PORT || 3000;

app.listen(PORT, console.log(`Server running on  ${PORT}`));
