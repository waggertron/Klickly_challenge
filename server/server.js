const express = require('express');
const config = require('config');
const redis = require("redis");
const session = require('express-session');

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mongoClient = require('mongodb');
const authCtrl = require('./controllers/authController');
const migrationCtrl = require('./controllers/migrationController');

const mongoURL = config.get('db.mongo.URL');
const redisClient = redis.createClient();

const redisStore = require('connect-redis')(session);


const app = express();

app.use(session({
  secret: config.get('redis.SECRET'),
  store: new redisStore({ host: config.get('redis.HOST'), port: config.get('redis.PORT'), client: redisClient, ttl: config.get('redis.TTL') }),
  saveUninitialized: false,
  resave: false,
}));

app.use(cookieParser());

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

