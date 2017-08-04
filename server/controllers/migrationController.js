const config = require('config');
// const async = require('async');
const mongoClient = require('mongodb');
const request = require('request');

const mongoURL = config.get('db.mongo.URL');
const migrationCtrl = {};

// TODO: refactor with promises, add account id to products
migrationCtrl.import = (req, res) => {
  mongoClient.connect(mongoURL, (err, db) => {
    if (err === null) {
      const { token, shop } = res.locals.shopData;
      const reqOptions = {
        url: `https://${shop}.myshopify.com/admin/products.json`,
        headers: {
          'X-Shopify-Access-Token': token,
        },
      };
      // TODO break into promises
      request(reqOptions, (error, response, body) => {
        if (error === null ) {
          console.log('body from products request in import');
          console.log(body);
          const items = JSON.parse(body).products;
          db.collection('accounts').insertOne({ token, shop }, (err, result) => {
            if (err === null) {
              items.forEach((prod) => {
                prod.shopId = result.insertedId;
                prod.shopName = shop;
              });
              db.collection('products').insertMany(items, (error, results) => {
                if (error === null) {
                  res.json(results);
                  return db.close();
                }
                res.error('could not add products');
                return db.close();
              });
            } else {
              res.error('could not add account');
              return db.close();
            }
          });
        } else {
          res.error('unable to connect with shopify');
          return db.close();
        }
      });
    } else {
      return res.error('Database connectivity issues');
    }
  });
};

migrationCtrl.checkStore = (req, res, next) => {
  mongoClient.connect(mongoURL, (err, db) => {
    if (err === null) {
      console.dir(res.locals);
      const shop = res.locals.shopName;
      db.collection('accounts').findOne({ shop }, (err, result) => {
        if (err == null && result) {
          console.log('shop found');
          console.log('result for shop');
          console.dir(result);
          // res.locals.shop = shop;
          migrationCtrl.update(req, res, db);
          res.send('foundshop');
        } else {
          next();
        }
      });
    } else {
      return res.error('db connection error');
    }
  });
};

migrationCtrl.update = (req, res, db) => {
  const { token, shop } = res.locals.shop;
  console.log(token, shop);
  const reqOptions = {
    url: `https://${shop}.myshopify.com/admin/products.json`,
    headers: {
      'X-Shopify-Access-Token': token,
    },
  };
  request(reqOptions, (error, response, body) => {
    const products = JSON.parse(body).products;
    db.collection('products').remove({});
  });
};
module.exports = migrationCtrl;
