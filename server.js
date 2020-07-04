const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');

// include the .env in the server
require('dotenv').config();

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/exercise-track',
{ useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false } );

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.use(express.static(__dirname + '/public'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Define mongoose DB schema and data structure to store
const userSchema = mongoose.Schema({
  username: { type: String, required: true },
  log: [{
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: String },
    _id: false
  }]
});

const User = new mongoose.model('User', userSchema);

// @POST /api/exercise/new-user : returns {username, _id}
app.post('/api/exercise/new-user', (req, res) => {
  const { username } = req.body;
  const newUser = new User({ username });
  newUser.save(err => {
    if (err) return console.error(err);
    // newUser successfully saved in DB!
  })
  res.json({username: newUser.username, _id: newUser._id});
});

// @GET api/exercise/users : returns array of all users
app.get('/api/exercise/users', (req, res) => {
  // by calling find without a first parameter it finds all
  User.find((err, data) => {
    if (err) return console.error(err);
    return res.json(data);
  });
});

// @POST /api/exercise/add : 1). find user by _id
// 2) add description, duration, and date field to user object in DB
// 3). fill in the date with current date if not supplied
// 4). return the user object, 5effc6d14a842708089aa48a
app.post('/api/exercise/add', (req, res) => {
  const { userId, description, duration } = req.body;
  let { date } = req.body;
  if (!date) {
    // if date not supplied, add the current date
    const currDate = new Date();
    const year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(currDate);    
    let month = '' + (currDate.getMonth() + 1);
    if (month.length < 2) 
      month = '0' + month;
    const day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(currDate);
    date = `${year}-${month}-${day}`;
  }
  let newExercise = {
    description,
    duration: parseInt(duration),
    date
  };
  User.findOneAndUpdate({_id: userId}, { $push: { log: newExercise }} ,(err, data) => {
    if (err) return console.error(err);
    console.log(date)
    res.json({
      _id: data._id,
      username: data.username,
      date,
      duration: parseInt(duration),
      description: description
    });
  });
});

// @GET /api/exercise/log?{userId}[&from][&to][&limit]
app.get('/api/exercise/log', (req, res) => {
  let { userId, from, to, limit } = req.query;
  if (!userId) {
    // required parameter
    res.status(400).send('userId parameter is missing');
  }
  User.findById({ _id: userId }, (err, data) => {
    if (err) return console.error(err);
    data['userId'] = data['_id'];
    delete data['_id'];
    if (limit) {
      limit = parseInt(limit);
      if (!isNaN(limit)) {
        // if given a valid number for limit
        data['log'] = data['log'].slice(0, limit);
      }
    }
    data['_doc']['count'] = data.log.length;
    if (from) {
      let fromDate = new Date(from);
      let logCopy = [...data['log']].filter(exercise => {
        let currDate = new Date(exercise['date']);
        return currDate > fromDate;
      });
      data['log'] = [...logCopy];
    }
    if (to) {
      let toDate = new Date(to);
      let logCopy = [...data['log']].filter(exercise => {
          let currDate = new Date(exercise['date']);
          return currDate < toDate;
      });
      data['log'] = [...logCopy];
    }
    
    res.json(data);
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
// 5effcc848b816c30d8153418