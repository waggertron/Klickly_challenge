const config = require('config');
const crypto = require('crypto');
const request = require('request');

const authCtrl = {};

const API_KEY = config.get('api.KEY');
const API_SECRET = config.get('api.SECRET');
const REDIRECT_URI = config.get('api.redirect_uri');
const scopes = 'read_products';

function replace(str, isKey = false) {
  let newStr = str.replace(/&/g, '%26');
  newStr = newStr.replace(/%/g, '%25');
  if (isKey) {
    newStr = newStr.replace(/=/g, '%3D');
  }
  return newStr;
}
function verifyHMAC(queryObject) {
  const query = Object.assign({}, queryObject);
  const hmac = query.hmac;
  delete query.hmac;
  const keys = Object.keys(query).sort();
  const result = keys.map((key) => {
    const val = queryObject[key];
    return `${replace(key, true)}=${replace(val)}`;
  });
  const serialized = result.join('&');
  const hmacConfirm = crypto.createHmac('sha256', API_SECRET);
  hmacConfirm.update(serialized);
  return hmacConfirm.digest('hex') === hmac;
}

authCtrl.Oauth = (req, res) => {
  const storeName = req.body.storeName || config.get('test.store');
  const nonce = `${Math.floor(Math.random() * 100000000)}`;
  req.session.key = { nonce, storeName };
  const oauthURL = `https://${storeName}.myshopify.com/admin/oauth/authorize?client_id=${API_KEY}&scope=${scopes}&redirect_uri=${REDIRECT_URI}&state=${nonce}`;
  res.redirect(oauthURL);
};

authCtrl.verifyOauth = (req, res, next) => {
  const { nonce } = req.session.key;
  const { shop, state } = req.query;
  if (!shop || !state) {
    return res.redirect('/');
  }
  if (nonce === state) {
    if (verifyHMAC(req.query)) {
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
