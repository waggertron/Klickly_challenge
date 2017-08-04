const config = require('config');
const assert = require('assert');
const async = require('async');
const mongoClient = require('mongodb');
const request = require('request');

const mongoURL = config.get('db.mongo.URL');
const migrationCtrl = {};

migrationCtrl.import = (req, res) => {
  mongoClient.connect(mongoURL, (err, db) => {
    if (err === null) {
      const {token, shop} = res.locals.shopData;
      const reqOptions = {
        url: `https://${shop}.myshopify.com/admin/products.json`,
        headers: {
          "X-Shopify-Access-Token": token,
        },
      };
      request(reqOptions, (error, response, body) => {
        if (error === null) {
          const items = JSON.parse(body).products;
          const products = db.collection('products');
          const accounts = db.collection('accounts');
          products.insertMany(items, (err, result) => {
            if (err === null) {
              res.json(result);
              console.log(result);
              return db.close();
            } else {
              res.error('could not add products')
            }
          })
        } else {
          res.error('unable to connect with shopify');
          db.close();
        }
      })
      
    } else {
      res.error('Database connectivity issues');
    }
  });
};
migrationCtrl.update = (req, res) => {
  
}
module.exports = migrationCtrl;
