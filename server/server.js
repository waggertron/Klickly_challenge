const express = require('express');
const config = require('config');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const authCtrl = require('./controllers/authController');
const migrationCtrl = require('./controllers/migrationController');

// TODO: HTTPS and JWTs

const app = express();

app.use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', express.static('client'));

app.post('/oauth', authCtrl.Oauth);

app.get('/api/migrate', authCtrl.confirmOauth, authCtrl.requestToken, migrationCtrl.checkStore, migrationCtrl.import);
// app.get('/api/migrate', authCtrl.confirmOauth, authCtrl.requestToken, migrationCtrl.checkStore, migrationCtrl.import);

app.listen(config.get('port'));
