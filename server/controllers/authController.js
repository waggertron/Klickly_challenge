const config = require('config');
const crypto = require('crypto');
const request = require('request');

const authCtrl = {};

const API_KEY = config.get('api.KEY');
const API_SECRET = config.get('api.SECRET');
const REDIRECT_URI = config.get('api.redirect_uri');
const scopes = 'read_products';


authCtrl.Oauth = (req, res) => {
  const storeName = req.body.storeName || config.get('test.store');
  const nonce = `${Math.floor(Math.random() * 100000000)}`;
  req.session.key = { nonce, storeName };
  const oauthURL = `https://${storeName}.myshopify.com/admin/oauth/authorize?client_id=${API_KEY}&scope=${scopes}&redirect_uri=${REDIRECT_URI}&state=${nonce}`;
  res.redirect(oauthURL);
};

authCtrl.verifyOauth = (req, res, next) => {
  const { nonce, storeName } = req.session.key;
  let { code, hmac, shop, state, timestamp } = req.query;
  if (nonce === state && `${storeName}.myshopify.com` === shop) {
    // this needs refactoring, get back to it
    [code, shop, state, timestamp] = [code, shop, state, timestamp].map((val) => {
      val = val.replace(/&/g, '%26');
      val = val.replace(/%/g, '%25');
      val = val.replace(/=/g, '%3D');
      return val;
    });
    const serial = `code=${code}&shop=${shop}&state=${state}&timestamp=${timestamp}`;
    const hmacConfirm = crypto.createHmac('sha256', API_SECRET);
    hmacConfirm.update(serial);
    const result = hmacConfirm.digest('hex');
    if (result === hmac) {
      res.locals.code = req.query.code;
      next();
    } else {
      return res.status(403).send('hmac invalid');
    }
  } else {
    return res.status(403).send('shopify response invalid');
  }
};

authCtrl.requestToken = (req, res, next) => {
  const { storeName } = req.session.key;
  const tokenReqURL = `https://${storeName}.myshopify.com/admin/oauth/access_token`;
  const authData = {
    client_id: API_KEY,
    client_secret: API_SECRET,
    code: res.locals.code,
  };
  request.post(tokenReqURL, { form: authData }, (err, httpResponse, body) => {
    if (err || httpResponse.statusCode !== 200) {
      console.log('inside request token error');
      console.log(err, httpResponse.statusCode);
      res.status(403).send('error accessing shopify data');
    } else {
      try {
        const token = JSON.parse(body).access_token;
        res.locals.storeName = storeName;
        res.locals.token = token;
        console.log('token granted', token);
        next();
      } catch (e) {
        res.error(e);
      }
    }
  });
};

module.exports = authCtrl;
