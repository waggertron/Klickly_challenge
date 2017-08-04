const config = require('config');
const crypto = require('crypto');
const request = require('request');

const authCtrl = {};

const API_KEY = config.get('api.KEY')
const API_SECRET = config.get('api.SECRET')
const redirect_uri = config.get('api.redirect_uri')
const scopes = 'read_products';

authCtrl.checkToken = (req, res, next) => {
  next();
};
authCtrl.Oauth = (req, res) => {
  // let shop = req.body.storeName
  const shop = 'tequila-mocking-bird' || req.body.storeName;
  const nonce = `${Math.floor(Math.random() * 100000000)}`;
  res.cookie('nonce', nonce, {httpOnly: true, maxAge:300000});
  res.cookie('shop_name', shop, {httpOnly: true, maxAge:9000000})
  const oauthURL = `https://${shop}.myshopify.com/admin/oauth/authorize?client_id=${API_KEY}&scope=${scopes}&redirect_uri=${redirect_uri}&state=${nonce}`;
  res.redirect(oauthURL);
};
authCtrl.confirmOauth = (req, res, next) => {
  const {nonce, shop_name} = req.cookies;
  let {code, hmac, shop, state, timestamp} = req.query;
  console.log(req.query);
  if (nonce === state && shop_name + '.myshopify.com' === shop) {
    // this needs refactoring, get back to it
    [code, shop, state, timestamp] = [code, shop,state, timestamp].map((val) => {
      val = val.replace(/&/g,'%26')
      val = val.replace(/%/g,'%25')
      val = val.replace(/=/g,'%3D');
      return val
    })
    const serial = `code=${code}&shop=${shop}&state=${state}&timestamp=${timestamp}`;
    const hmacConfirm = crypto.createHmac('sha256', API_SECRET);
    hmacConfirm.update(serial);
    const result = hmacConfirm.digest('hex');
    if (result === hmac) {
      res.locals.code = req.query.code
      return next()
    }
  }
  res.error('not valid');
}

authCtrl.requestToken = (req,res, next) => {
  const shopName = req.cookies.shop_name;
  const tokenReqURL = `https://${shopName}.myshopify.com/admin/oauth/access_token`;
  const authData = {client_id: API_KEY, 
    client_secret: API_SECRET, 
    code: res.locals.code, 
  }
  request.post(tokenReqURL, {form: authData}, (err,httpResponse,body) => {
    if (err === null) {
      const token = JSON.parse(body).access_token
      res.locals.shopData = {token, shop: shopName};
      return next();
    }
    res.error('Authorization Error');
  });
}

module.exports = authCtrl;
