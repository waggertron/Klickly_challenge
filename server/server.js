const express = require('express');
const config = require('config');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mongoClient = require('mongodb');
const authCtrl = require('./controllers/authController');
const migrationCtrl = require('./controllers/migrationController');

const mongoURL = config.get('db.mongo.URL');


const app = express();

app.use(cookieParser('length trumps randomness at all times'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', express.static('client'));

app.post('/oauth', migrationCtrl.checkForAccount, authCtrl.Oauth);

app.get('/api/migrate', authCtrl.verifyOauth, authCtrl.requestToken, migrationCtrl.import);
mongoClient.connect(mongoURL, (err, db) => {
  if (err) {
    console.error(err);
    process.exit(1);
  } else {
    app.listen(config.get('port'));
    app.locals.db = db;
  }
});

